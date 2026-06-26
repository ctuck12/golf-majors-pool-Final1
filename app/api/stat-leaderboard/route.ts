export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const BATCH_SIZE = 25;

// Recent PGA Tour major events — used as reliable source of active PGA Tour player IDs
// (avoids Champions Tour / dual-status players that appear in season athlete lists)
const PGA_EVENT_IDS = ['401811952', '401811947', '401811941']; // US Open, PGA Champ, Masters

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

const LOWER_IS_BETTER = new Set(['scoringAverage', 'avgPuttsPerRound']);

const statDefs: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number; altMultiplier?: number }> = [
  { key: 'drivingDistance', espnName: 'driveDistAvg', isPercent: false, decimals: 1 },
  { key: 'drivingDistance', espnName: 'yardsPerDrive', isPercent: false, decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensInRegPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensInReg', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'girPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensHit', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scramblingPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambling', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambPct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSavePct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSave', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'bunkerSavePct', isPercent: true, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsPerRound', isPercent: false, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'avgPutts', isPercent: false, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'avgPutt', isPercent: false, decimals: 1 },
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

// Check value, displayValue, average, and averageDisplayValue — different ESPN stats use different fields
function statNumeric(stats: Stat[], name: string): number | null {
  const s = stats.find((x) => x.name === name);
  if (!s) return null;
  // Primary: value field
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  // Secondary: parse displayValue (e.g. "78.2" or "78.2%")
  const dv = parseFloat(s.displayValue ?? '');
  if (!isNaN(dv) && dv !== 0) return dv;
  // Tertiary: average field (used by ESPN for sand saves and some other % stats)
  if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
  const av = parseFloat(s.averageDisplayValue ?? '');
  if (!isNaN(av) && av !== 0) return av;
  return null;
}

function formatValue(v: number, key: string): string {
  const def = statDefs.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

// Get unique PGA Tour player ESPN IDs from recent major events
// This guarantees we only show active PGA Tour players (not Champions Tour)
async function fetchPgaPlayerIds(): Promise<string[]> {
  const idSet = new Set<string>();
  await Promise.all(PGA_EVENT_IDS.map(async (eventId) => {
    try {
      const res = await fetch(
        `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`,
        { cache: 'no-store', signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return;
      const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
      for (const item of data.items ?? []) {
        const id = item.id ?? item.$ref?.match(/competitors\/(\d+)/)?.[1];
        if (id) idSet.add(id);
      }
    } catch { /* ignore */ }
  }));
  console.log(`[stat-lb] pgaPlayerIds=${idSet.size}`);
  return Array.from(idSet);
}

// Fetch overview and return merged seasonRankings.categories + summaryStatistics
// Different stats live in different sections; merging ensures we find all of them
async function fetchAthleteOverviewStats(espnId: string): Promise<Stat[] | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as { seasonRankings?: { categories?: Stat[] }; summaryStatistics?: Stat[] };
    const cats = data?.seasonRankings?.categories ?? [];
    const sumStats = data?.summaryStatistics ?? [];
    const merged = [...cats, ...sumStats];
    return merged.length > 0 ? merged : null;
  } catch {
    return null;
  }
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

  const cacheKey = `stat-lb:v10:${statKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const ids = await fetchPgaPlayerIds();
    if (ids.length === 0) return Response.json({ entries: [] });

    const defsForKey = statDefs.filter((d) => d.key === statKey);
    const playerValues: Array<{ espnId: string; value: number }> = [];

    // Fetch overview stats for all players (contains season stats, GIR %, sand saves %, scrambling, etc.)
    const allOverviewStats = await batchAll(
      ids.map((id) => () => fetchAthleteOverviewStats(id)),
      BATCH_SIZE,
    );

    for (let i = 0; i < ids.length; i++) {
      const stats = allOverviewStats[i];
      if (!stats) continue;
      for (const def of defsForKey) {
        let raw = statNumeric(stats, def.espnName);
        if (raw === null) continue;
        if (def.altMultiplier) raw = raw * def.altMultiplier;
        playerValues.push({ espnId: ids[i], value: raw });
        break;
      }
    }

    console.log(`[stat-lb] statKey=${statKey} pgaPlayers=${ids.length} withValues=${playerValues.length}`);
    if (playerValues.length === 0) {
      const first = allOverviewStats.find(Boolean);
      if (first) console.log(`[stat-lb] sampleStatNames=${JSON.stringify(first.map((s: Stat) => s.name))}`);
      return Response.json({ entries: [] });
    }

    playerValues.sort((a, b) =>
      LOWER_IS_BETTER.has(statKey) ? a.value - b.value : b.value - a.value
    );
    const top10 = playerValues.slice(0, 10);

    const names = await Promise.all(top10.map((p) => fetchAthleteName(p.espnId)));

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
