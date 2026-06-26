export type StatAverages = Record<string, string>;

import redis from '@/app/lib/redis';

const TOUR_AVG_LB_PREFIX = 'tour-avg:lb:v1:';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_EVENT_IDS = ['401811952', '401811947', '401811941'];
const BATCH_SIZE = 25;

// PGA Tour GQL stat IDs for tour averages
const GQL_STAT_MAP: Array<{ statId: string; key: string; suffix?: string; multiplier?: number }> = [
  { statId: '101', key: 'drivingDistance' },
  { statId: '102', key: 'drivingAccuracy', suffix: '%' },
  { statId: '103', key: 'gir', suffix: '%' },
  { statId: '130', key: 'scrambling', suffix: '%' },
  { statId: '107', key: 'sandSaves', suffix: '%' },
  { statId: '108', key: 'scoringAverage' },
  { statId: '104', key: 'avgPuttsPerRound', multiplier: 18 },
];

// ESPN stat names — for percentage stats, displayValue has the correct number; value field may be a raw count
const COMPUTED_STAT_DEFS: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number; altMultiplier?: number; useAvgField?: boolean }> = [
  { key: 'drivingDistance', espnName: 'yardsPerDrive', decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },           // displayValue = "65.2", value = raw count
  { key: 'gir', espnName: 'greensInRegPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambling', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scramblingPct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1, useAvgField: true }, // % is in average field
  { key: 'sandSaves', espnName: 'sandSavePct', isPercent: true, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsPerRound', decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsGirAvg', decimals: 1, altMultiplier: 18 },
];

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };
type OverviewData = {
  seasonRankings?: { categories?: Stat[] };
  summaryStatistics?: Stat[];
  statistics?: { names?: string[]; splits?: Array<{ displayName?: string; stats?: string[] }> };
};

function statNumericSafe(stats: Stat[], def: typeof COMPUTED_STAT_DEFS[0]): number | null {
  const s = stats.find((x) => x.name === def.espnName);
  if (!s) return null;
  if (def.useAvgField) {
    if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
    const av = parseFloat(s.averageDisplayValue ?? '');
    if (!isNaN(av) && av !== 0) return av;
    return null;
  }
  if (def.isPercent) {
    const dv = parseFloat((s.displayValue ?? '').replace('%', ''));
    if (!isNaN(dv) && dv !== 0) return dv;
  }
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  const dv2 = parseFloat((s.displayValue ?? '').replace('%', ''));
  if (!isNaN(dv2) && dv2 !== 0) return dv2;
  return null;
}

function splitStatNumeric(data: OverviewData, pattern: RegExp): number | null {
  const names = data.statistics?.names ?? [];
  const splits = data.statistics?.splits ?? [];
  const split = splits.find((s) => s.displayName?.includes('PGA')) ?? splits[0];
  if (!split) return null;
  const idx = names.findIndex((n) => pattern.test(n));
  if (idx < 0) return null;
  const raw = split.stats?.[idx] ?? '';
  const num = parseFloat(raw.replace('%', ''));
  return !isNaN(num) && num !== 0 ? num : null;
}

function formatAvg(v: number, key: string): string {
  const def = COMPUTED_STAT_DEFS.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

async function fetchStatTourAvg(statId: string): Promise<string | null> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query: `query StatDetails($statId: ID!) { statDetails(statId: $statId) { tourAvg } }`, variables: { statId } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { statDetails?: { tourAvg?: string } } };
    return data?.data?.statDetails?.tourAvg ?? null;
  } catch { return null; }
}

async function fetchFromGql(): Promise<StatAverages> {
  const results: StatAverages = {};
  await Promise.all(GQL_STAT_MAP.map(async ({ statId, key, suffix, multiplier }) => {
    const raw = await fetchStatTourAvg(statId);
    if (!raw) return;
    let val = raw.trim();
    if (multiplier) { const n = parseFloat(val); if (!isNaN(n)) val = (n * multiplier).toFixed(1); }
    if (suffix && !val.endsWith(suffix)) val = `${val}${suffix}`;
    console.log(`[tour-avg] key=${key} source=GQL value=${val}`);
    results[key] = val;
  }));
  return results;
}

async function fetchPgaPlayerIds(): Promise<string[]> {
  const idSet = new Set<string>();
  await Promise.all(PGA_EVENT_IDS.map(async (eventId) => {
    try {
      const res = await fetch(`${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
      for (const item of data.items ?? []) {
        const id = item.id ?? item.$ref?.match(/competitors\/(\d+)/)?.[1];
        if (id) idSet.add(id);
      }
    } catch { /* ignore */ }
  }));
  return Array.from(idSet);
}

async function fetchOverviewData(espnId: string): Promise<OverviewData | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json() as OverviewData;
  } catch { return null; }
}

async function batchAll<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...await Promise.all(tasks.slice(i, i + size).map((t) => t())));
  }
  return results;
}

// Stats that come from statistics.splits (not seasonRankings.categories)
const SPLIT_STAT_PATTERNS: Array<{ key: string; pattern: RegExp; isPercent: boolean }> = [
  { key: 'gir', pattern: /green.*regulation|greens in reg/i, isPercent: true },
  { key: 'scrambling', pattern: /scrambling/i, isPercent: true },
  { key: 'sandSaves', pattern: /sand save|bunker save/i, isPercent: true },
];

async function computeFromAllPlayers(): Promise<StatAverages> {
  const ids = await fetchPgaPlayerIds();
  if (ids.length === 0) return {};
  const allOverviews = await batchAll(ids.map((id) => () => fetchOverviewData(id)), BATCH_SIZE);

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const data of allOverviews) {
    if (!data) continue;
    const cats = [...(data.seasonRankings?.categories ?? []), ...(data.summaryStatistics ?? [])];
    const seen = new Set<string>();

    // Category-based stats (drivingDistance, drivingAccuracy, avgPuttsPerRound)
    for (const def of COMPUTED_STAT_DEFS) {
      if (seen.has(def.key)) continue;
      let raw = statNumericSafe(cats, def);
      if (raw === null) continue;
      if (def.altMultiplier) raw = raw * def.altMultiplier;
      sums[def.key] = (sums[def.key] ?? 0) + raw;
      counts[def.key] = (counts[def.key] ?? 0) + 1;
      seen.add(def.key);
    }

    // Split-based stats (gir, scrambling, sandSaves) — live in statistics.splits
    for (const { key, pattern } of SPLIT_STAT_PATTERNS) {
      if (seen.has(key)) continue;
      const raw = splitStatNumeric(data, pattern);
      if (raw === null) continue;
      sums[key] = (sums[key] ?? 0) + raw;
      counts[key] = (counts[key] ?? 0) + 1;
      seen.add(key);
    }
  }

  const results: StatAverages = {};
  for (const key of Object.keys(sums)) {
    const avg = sums[key] / counts[key];
    const isPercent = COMPUTED_STAT_DEFS.find((d) => d.key === key)?.isPercent
      ?? SPLIT_STAT_PATTERNS.find((d) => d.key === key)?.isPercent ?? false;
    const decimals = COMPUTED_STAT_DEFS.find((d) => d.key === key)?.decimals ?? 1;
    results[key] = isPercent ? `${avg.toFixed(decimals)}%` : avg.toFixed(decimals);
    console.log(`[tour-avg] key=${key} source=computed avg=${results[key]} n=${counts[key]}`);
  }
  return results;
}

const LB_STAT_KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'scrambling', 'sandSaves', 'avgPuttsPerRound', 'scoringAverage'];

async function fetchFromLeaderboardCache(): Promise<StatAverages> {
  const results: StatAverages = {};
  await Promise.all(LB_STAT_KEYS.map(async (key) => {
    try {
      const val = await redis.get(`${TOUR_AVG_LB_PREFIX}${key}`);
      if (val) { results[key] = val; console.log(`[tour-avg] key=${key} source=lb-cache value=${val}`); }
    } catch { /* ignore */ }
  }));
  return results;
}

export async function fetchTourAverages(): Promise<StatAverages> {
  // Primary: read averages computed by stat-leaderboard route (covers all 6 course stats accurately)
  try {
    const lbResults = await fetchFromLeaderboardCache();
    if (Object.keys(lbResults).length >= 4) {
      return lbResults;
    }
    console.log(`[tour-avg] lb-cache returned only ${Object.keys(lbResults).length} stats, trying GQL`);
  } catch (err) {
    console.log(`[tour-avg] lb-cache failed: ${err}`);
  }

  // Secondary: PGA Tour GQL statDetails tourAvg
  try {
    const gqlResults = await fetchFromGql();
    if (Object.keys(gqlResults).length >= 4) {
      return gqlResults;
    }
    console.log(`[tour-avg] GQL returned only ${Object.keys(gqlResults).length} stats, falling back to computed`);
  } catch (err) {
    console.log(`[tour-avg] GQL failed: ${err}`);
  }

  // Fallback: compute mean from all PGA Tour player ESPN overview stats
  try {
    return await computeFromAllPlayers();
  } catch (err) {
    console.log(`[tour-avg] computed fallback failed: ${err}`);
    return {};
  }
}
