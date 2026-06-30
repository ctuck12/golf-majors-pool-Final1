export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { getOrBuildPgaLeaderboard } from '@/app/lib/tournament-sg-leaderboard';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const FIELD_AVG_TTL = 1800; // 30 minutes
const BATCH_SIZE = 25;

type Stat = { name?: string; value?: number; displayValue?: string };

function getStat(stats: Stat[], name: string): Stat | undefined {
  return stats.find((s) => s.name === name);
}

function statNumeric(stats: Stat[], name: string): number | null {
  const s = getStat(stats, name);
  const v = s?.value ?? parseFloat(s?.displayValue ?? '');
  return !isNaN(v) && v !== 0 ? v : null;
}

async function fetchCompetitorIds(eventId: string): Promise<string[]> {
  try {
    const url = `${ESPN_CORE}/pga/events/${eventId}/competitions/${eventId}/competitors?limit=500`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
    const items = data.items ?? [];
    return items.map((item) => {
      if (item.id) return item.id;
      const match = item.$ref?.match(/competitors\/(\d+)/);
      return match?.[1] ?? '';
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchCompetitorStats(espnId: string, eventId: string): Promise<Stat[] | null> {
  try {
    const url = `${ESPN_CORE}/pga/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics/0`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json() as { splits?: { categories?: Array<{ stats?: Stat[] }> } };
    const stats = data?.splits?.categories?.[0]?.stats;
    return Array.isArray(stats) && stats.length > 0 ? stats : null;
  } catch {
    return null;
  }
}

async function batchAll<T>(tasks: (() => Promise<T>)[], batchSize: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((t) => t());
    results.push(...await Promise.all(batch));
  }
  return results;
}

function formatAvg(avg: number, isPercent: boolean, decimals: number): string {
  const val = avg.toFixed(decimals);
  return isPercent ? `${val}%` : val;
}

// Stats where lower is better (for rank computation: rank 1 = lowest value)
const LOWER_IS_BETTER = new Set(['scoringAverage', 'avgPuttsPerRound']);

const statDefs: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number; altMultiplier?: number }> = [
  { key: 'drivingDistance', espnName: 'driveDistAvg', isPercent: false, decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scramblingPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambling', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambPct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsPerRound', isPercent: false, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsGirAvg', isPercent: false, decimals: 1, altMultiplier: 18 },
  // SG stats — ESPN Core may provide these; populated when available
  { key: 'sgTotal', espnName: 'strokesGainedTotal', isPercent: false, decimals: 3 },
  { key: 'sgTotal', espnName: 'sgTotal', isPercent: false, decimals: 3 },
  { key: 'sgOffTee', espnName: 'strokesGainedOffTee', isPercent: false, decimals: 3 },
  { key: 'sgOffTee', espnName: 'sgOffTee', isPercent: false, decimals: 3 },
  { key: 'sgApproach', espnName: 'strokesGainedApproach', isPercent: false, decimals: 3 },
  { key: 'sgApproach', espnName: 'sgApproach', isPercent: false, decimals: 3 },
  { key: 'sgAroundGreen', espnName: 'strokesGainedAroundGreen', isPercent: false, decimals: 3 },
  { key: 'sgAroundGreen', espnName: 'sgAroundGreen', isPercent: false, decimals: 3 },
  { key: 'sgPutting', espnName: 'strokesGainedPutting', isPercent: false, decimals: 3 },
  { key: 'sgPutting', espnName: 'sgPutting', isPercent: false, decimals: 3 },
];

export type FieldData = {
  averages: Record<string, string>;
  // Sorted values best-first per stat — used to compute field rank for a given player value
  distributions: Record<string, number[]>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId') ?? '';
  if (!eventId) return Response.json({ averages: {}, distributions: {} });

  const cacheKey = `field-averages:v8:${eventId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json(JSON.parse(cached));

    const ids = await fetchCompetitorIds(eventId);
    if (ids.length === 0) return Response.json({ averages: {}, distributions: {} });

    const allStats = await batchAll(
      ids.map((id) => () => fetchCompetitorStats(id, eventId)),
      BATCH_SIZE,
    );

    // Collect raw values per stat key
    const rawValues: Record<string, number[]> = {};

    for (const stats of allStats) {
      if (!stats) continue;
      for (const def of statDefs) {
        let v = statNumeric(stats, def.espnName);
        if (v === null) continue;
        if (def.altMultiplier) v = v * def.altMultiplier;
        if (!rawValues[def.key]) rawValues[def.key] = [];
        rawValues[def.key].push(v);
      }
    }

    const averages: Record<string, string> = {};
    const distributions: Record<string, number[]> = {};

    for (const [key, values] of Object.entries(rawValues)) {
      if (values.length < 5) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const def = statDefs.find((d) => d.key === key)!;
      averages[key] = formatAvg(sum / values.length, def.isPercent ?? false, def.decimals ?? 1);
      // Sort best-first so distributions[key].indexOf(value)+1 ≈ rank
      distributions[key] = LOWER_IS_BETTER.has(key)
        ? [...values].sort((a, b) => a - b)
        : [...values].sort((a, b) => b - a);
    }

    // Scrambling isn't in ESPN's per-event stats, so its field average comes from the PGA leaderboard
    // (the same source the scrambling popup uses) — otherwise the card cell would fall back to the
    // SEASON average mislabeled "Field Avg" and disagree with the popup.
    try {
      const scrLb = await getOrBuildPgaLeaderboard(eventId, 'scrambling');
      if (scrLb?.fieldAvg) {
        averages['scrambling'] = scrLb.fieldAvg;
        const vals = scrLb.entries.map((e) => parseFloat(e.value)).filter((v) => !isNaN(v)).sort((a, b) => b - a);
        if (vals.length >= 5) distributions['scrambling'] = vals;
      }
    } catch { /* leave scrambling absent if the PGA feed is unavailable */ }

    const result: FieldData = { averages, distributions };

    if (Object.keys(averages).length > 0) {
      await redis.setex(cacheKey, FIELD_AVG_TTL, JSON.stringify(result));
    }

    return Response.json(result);
  } catch {
    return Response.json({ averages: {}, distributions: {} });
  }
}
