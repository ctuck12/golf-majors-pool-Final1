export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const BATCH_SIZE = 25;

type Stat = { name?: string; value?: number; displayValue?: string };

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
  { key: 'sgTeeToGreen', espnName: 'strokesGainedTeeToGreen', isPercent: false, decimals: 3 },
  { key: 'sgTeeToGreen', espnName: 'sgTeeToGreen', isPercent: false, decimals: 3 },
  { key: 'scoringAverage', espnName: 'scoringAverage', isPercent: false, decimals: 2 },
  { key: 'scoringAverage', espnName: 'adjScoringAvg', isPercent: false, decimals: 2 },
  { key: 'scoringAverage', espnName: 'scoringAvg', isPercent: false, decimals: 2 },
];

export type StatLeaderboardEntry = {
  rank: number;
  name: string;
  value: string;
};

function statNumeric(stats: Stat[], name: string): number | null {
  const s = stats.find((x) => x.name === name);
  const v = s?.value ?? parseFloat(s?.displayValue ?? '');
  return !isNaN(v) && v !== 0 ? v : null;
}

function formatValue(v: number, key: string): string {
  const def = statDefs.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

async function fetchSeasonAthleteIds(): Promise<string[]> {
  const year = new Date().getFullYear();
  // Try to get athlete list from current season; falls back to previous year
  for (const y of [year, year - 1]) {
    try {
      const res = await fetch(
        `${ESPN_CORE}/seasons/${y}/athletes?limit=500`,
        { cache: 'no-store', signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
      const ids = (data.items ?? []).map((item) => {
        if (item.id) return item.id;
        const match = item.$ref?.match(/athletes\/(\d+)/);
        return match?.[1] ?? '';
      }).filter(Boolean);
      if (ids.length > 0) {
        console.log(`[stat-lb] season=${y} athleteCount=${ids.length}`);
        return ids;
      }
    } catch { /* try next year */ }
  }
  return [];
}

async function fetchAthleteSeasonStats(espnId: string): Promise<Stat[] | null> {
  const year = new Date().getFullYear();
  const urls = [
    `${ESPN_CORE}/seasons/${year}/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/seasons/${year}/athletes/${espnId}/statistics`,
    `${ESPN_CORE}/seasons/${year - 1}/athletes/${espnId}/statistics/0`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json() as {
        splits?: { categories?: Array<{ stats?: Stat[] }> } | Array<{ stats?: Stat[] }>;
        categories?: Array<{ stats?: Stat[] }>;
        stats?: Stat[];
      };
      if (data?.splits && !Array.isArray(data.splits)) {
        const stats = (data.splits as { categories?: Array<{ stats?: Stat[] }> }).categories?.[0]?.stats;
        if (Array.isArray(stats) && stats.length > 0) return stats;
      }
      if (Array.isArray(data?.splits)) {
        for (const split of data.splits as Array<{ stats?: Stat[] }>) {
          if (Array.isArray(split?.stats) && split.stats.length > 0) return split.stats;
        }
      }
      const cats = data?.categories;
      if (Array.isArray(cats) && cats[0]?.stats?.length) return cats[0].stats;
      if (Array.isArray(data?.stats) && data.stats.length > 0) return data.stats;
    } catch { continue; }
  }
  return null;
}

async function fetchAthleteName(espnId: string): Promise<string> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/athletes/${espnId}?lang=en&region=us`,
      { cache: 'no-store', signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return '';
    const data = await res.json() as { displayName?: string; fullName?: string; firstName?: string; lastName?: string };
    return data?.displayName ?? data?.fullName
      ?? ([data?.firstName, data?.lastName].filter(Boolean).join(' '))
      ?? '';
  } catch {
    return '';
  }
}

async function batchAll<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...await Promise.all(tasks.slice(i, i + size).map((t) => t())));
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  if (!statKey) return Response.json({ entries: [] });

  const cacheKey = `stat-lb:v8:${statKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const ids = await fetchSeasonAthleteIds();
    if (ids.length === 0) return Response.json({ entries: [] });

    const allStats = await batchAll(
      ids.map((id) => () => fetchAthleteSeasonStats(id)),
      BATCH_SIZE,
    );

    const defsForKey = statDefs.filter((d) => d.key === statKey);
    const playerValues: Array<{ espnId: string; value: number }> = [];

    for (let i = 0; i < ids.length; i++) {
      const stats = allStats[i];
      if (!stats) continue;
      for (const def of defsForKey) {
        let raw = statNumeric(stats, def.espnName);
        if (raw === null) continue;
        if (def.altMultiplier) raw = raw * def.altMultiplier;
        playerValues.push({ espnId: ids[i], value: raw });
        break;
      }
    }

    console.log(`[stat-lb] statKey=${statKey} totalAthletes=${ids.length} withValues=${playerValues.length}`);
    if (playerValues.length === 0) return Response.json({ entries: [] });

    playerValues.sort((a, b) =>
      LOWER_IS_BETTER.has(statKey) ? a.value - b.value : b.value - a.value
    );
    const top10 = playerValues.slice(0, 10);

    const names = await Promise.all(top10.map((p) => fetchAthleteName(p.espnId)));
    console.log(`[stat-lb] top10ids=${top10.map(p => p.espnId)} names=${JSON.stringify(names)}`);

    const entries: StatLeaderboardEntry[] = top10.map((p, i) => ({
      rank: i + 1,
      name: names[i],
      value: formatValue(p.value, statKey),
    })).filter((e) => e.name);

    if (entries.length > 0) {
      try { await redis.setex(cacheKey, 3600, JSON.stringify(entries)); } catch { /* ignore */ }
    }
    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}
