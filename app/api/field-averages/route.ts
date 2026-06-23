export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

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

// Fetch all competitor ESPN IDs directly from ESPN Core (works for live and completed events)
async function fetchCompetitorIds(eventId: string): Promise<string[]> {
  try {
    const url = `${ESPN_CORE}/pga/events/${eventId}/competitions/${eventId}/competitors?limit=500`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as {
      items?: Array<{ id?: string; $ref?: string }>;
    };
    const items = data.items ?? [];
    return items.map((item) => {
      if (item.id) return item.id;
      // Extract ID from $ref URL: ".../competitors/12345"
      const match = item.$ref?.match(/competitors\/(\d+)/);
      return match?.[1] ?? '';
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// Fetch stats for one competitor from ESPN Core
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

// Run an array of async tasks in serial batches
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId') ?? '';
  if (!eventId) return Response.json({ averages: {} });

  const cacheKey = `field-averages:v3:${eventId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ averages: JSON.parse(cached) });

    const ids = await fetchCompetitorIds(eventId);
    if (ids.length === 0) return Response.json({ averages: {} });

    // Fetch stats for all competitors in batches
    const allStats = await batchAll(
      ids.map((id) => () => fetchCompetitorStats(id, eventId)),
      BATCH_SIZE,
    );

    // Accumulate totals for each stat field
    type Acc = { sum: number; count: number; isPercent: boolean; decimals: number };
    const acc: Record<string, Acc> = {};

    const statDefs: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number }> = [
      { key: 'drivingDistance', espnName: 'driveDistAvg', isPercent: false, decimals: 1 },
      { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
      { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
      { key: 'scrambling', espnName: 'sandSaves', isPercent: true, decimals: 1 },
      { key: 'avgPuttsPerRound', espnName: 'puttsPerRound', isPercent: false, decimals: 1 },
      { key: 'avgPuttsPerRound_alt', espnName: 'puttsGirAvg', isPercent: false, decimals: 2 }, // fallback: ×18
    ];

    for (const stats of allStats) {
      if (!stats) continue;
      for (const def of statDefs) {
        const v = statNumeric(stats, def.espnName);
        if (v === null) continue;
        const outKey = def.key.replace('_alt', '');
        if (!acc[outKey]) acc[outKey] = { sum: 0, count: 0, isPercent: def.isPercent ?? false, decimals: def.decimals ?? 1 };
        // puttsGirAvg needs ×18 to get putts/round
        acc[outKey].sum += def.key === 'avgPuttsPerRound_alt' ? v * 18 : v;
        acc[outKey].count += 1;
      }
    }

    const averages: Record<string, string> = {};
    for (const [key, { sum, count, isPercent, decimals }] of Object.entries(acc)) {
      if (count < 5) continue;
      averages[key] = formatAvg(sum / count, isPercent, decimals);
    }

    if (Object.keys(averages).length > 0) {
      await redis.setex(cacheKey, FIELD_AVG_TTL, JSON.stringify(averages));
    }

    return Response.json({ averages });
  } catch {
    return Response.json({ averages: {} });
  }
}
