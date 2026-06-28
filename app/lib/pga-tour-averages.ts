export type StatAverages = Record<string, string>;

import redis from '@/app/lib/redis';

const TOUR_AVG_LB_PREFIX = 'tour-avg:lb:v1:';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_EVENT_IDS = ['401811952', '401811947', '401811941'];
const BATCH_SIZE = 25;

// Stat IDs → tour average config
// statDetails returns a StatDetailTourAvg row with the official tour average directly.
const GQL_LB_STAT_MAP: Array<{ statId: string; key: string; suffix?: string; decimals: number }> = [
  { statId: '101', key: 'drivingDistance', decimals: 1 },
  { statId: '102', key: 'drivingAccuracy', suffix: '%', decimals: 1 },
  { statId: '103', key: 'gir', suffix: '%', decimals: 2 },
  { statId: '130', key: 'scrambling', suffix: '%', decimals: 2 },
  { statId: '111', key: 'sandSaves', suffix: '%', decimals: 2 },
  { statId: '108', key: 'scoringAverage', decimals: 2 },
  { statId: '104', key: 'puttAverage', decimals: 3 },
];

// ESPN overview category stat definitions — fallback only
type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };
type OverviewData = {
  seasonRankings?: { categories?: Stat[] };
  summaryStatistics?: Stat[];
  statistics?: { names?: string[]; splits?: Array<{ displayName?: string; stats?: string[] }> };
};

const COMPUTED_STAT_DEFS: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number; altMultiplier?: number; useAvgField?: boolean }> = [
  { key: 'drivingDistance', espnName: 'yardsPerDrive', decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'puttAverage', espnName: 'puttsGirAvg', decimals: 3 },
];
const SPLIT_STAT_PATTERNS: Array<{ key: string; pattern: RegExp; isPercent: boolean; decimals: number }> = [
  { key: 'gir', pattern: /green.*regulation|greens in reg/i, isPercent: true, decimals: 2 },
  { key: 'scrambling', pattern: /scrambling/i, isPercent: true, decimals: 2 },
  { key: 'sandSaves', pattern: /sand save|bunker save/i, isPercent: true, decimals: 2 },
];

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

async function gqlPost(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(PGA_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GQL HTTP ${res.status}`);
  return res.json();
}

// Fetch the official tour average from statDetails — the StatDetailTourAvg row contains it directly.
async function fetchTourAvgFromStatDetails(statId: string, suffix?: string, decimals = 1): Promise<string | null> {
  try {
    const query = `
      query StatDetails($statId: String!) {
        statDetails(tourCode: R, statId: $statId) {
          rows {
            ... on StatDetailTourAvg {
              displayName
              value
            }
          }
        }
      }
    `;
    const data = await gqlPost(query, { statId }) as {
      data?: { statDetails?: { rows?: Array<{ displayName?: string; value?: string }> } };
    };
    const rows = data?.data?.statDetails?.rows;
    if (!Array.isArray(rows)) return null;
    const avgRow = rows.find((r) => r.displayName != null);
    if (!avgRow?.value) return null;
    const num = parseFloat(avgRow.value.replace('%', ''));
    if (isNaN(num) || num === 0) return null;
    const str = num.toFixed(decimals);
    const result = suffix && !str.endsWith(suffix) ? `${str}${suffix}` : str;
    console.log(`[tour-avg] statId=${statId} source=statDetails-tourAvg avg=${result}`);
    return result;
  } catch { return null; }
}



async function fetchFromGqlLeaderboard(): Promise<StatAverages> {
  const results: StatAverages = {};
  await Promise.all(GQL_LB_STAT_MAP.map(async ({ statId, key, suffix, decimals }) => {
    const val = await fetchTourAvgFromStatDetails(statId, suffix, decimals);
    if (val) results[key] = val;
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

    for (const def of COMPUTED_STAT_DEFS) {
      if (seen.has(def.key)) continue;
      let raw = statNumericSafe(cats, def);
      if (raw === null) continue;
      if (def.altMultiplier) raw = raw * def.altMultiplier;
      sums[def.key] = (sums[def.key] ?? 0) + raw;
      counts[def.key] = (counts[def.key] ?? 0) + 1;
      seen.add(def.key);
    }

    for (const { key, pattern } of SPLIT_STAT_PATTERNS) {
      if (seen.has(key)) continue;
      const raw = splitStatNumeric(data, pattern);
      if (raw === null) continue;
      sums[key] = (sums[key] ?? 0) + raw;
      counts[key] = (counts[key] ?? 0) + 1;
      seen.add(key);
    }

    // GIR: compute from greensHit count / (totalDrives × 9) — totalDrives = 9-hole halves played
    if (!seen.has('gir')) {
      const rawCats = data.seasonRankings?.categories ?? [];
      const ghStat = rawCats.find((c) => c.name === 'greensHit');
      const tdStat = rawCats.find((c) => c.name === 'totalDrives');
      if (ghStat?.value && tdStat?.value && tdStat.value > 2) {
        const pct = (ghStat.value / (tdStat.value * 9)) * 100;
        if (pct > 40 && pct < 90) {
          sums['gir'] = (sums['gir'] ?? 0) + pct;
          counts['gir'] = (counts['gir'] ?? 0) + 1;
          seen.add('gir');
        }
      }
    }
  }

  const results: StatAverages = {};
  for (const key of Object.keys(sums)) {
    const avg = sums[key] / counts[key];
    const pctDef = SPLIT_STAT_PATTERNS.find((d) => d.key === key);
    const catDef = COMPUTED_STAT_DEFS.find((d) => d.key === key);
    const isPercent = (pctDef?.isPercent ?? catDef?.isPercent ?? false) || key === 'gir';
    const decimals = pctDef?.decimals ?? catDef?.decimals ?? 1;
    results[key] = isPercent ? `${avg.toFixed(decimals)}%` : avg.toFixed(decimals);
    console.log(`[tour-avg] key=${key} source=espn-computed avg=${results[key]} n=${counts[key]}`);
  }
  return results;
}

const LB_STAT_KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'scrambling', 'sandSaves', 'puttAverage', 'scoringAverage'];

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
  // Always read lb-cache (populated by stat-leaderboard route) in parallel with GQL.
  // GQL covers most stats but not sandSaves (stat 107 excluded — unreliable).
  // lb-cache fills the gaps, especially sandSaves computed from ESPN Core types/2.
  const [gqlResults, lbResults] = await Promise.allSettled([
    fetchFromGqlLeaderboard(),
    fetchFromLeaderboardCache(),
  ]);

  const gql = gqlResults.status === 'fulfilled' ? gqlResults.value : {};
  const lb = lbResults.status === 'fulfilled' ? lbResults.value : {};

  // GQL wins — it uses StatDetailTourAvg (official PGA Tour number), same source as the popup
  // lb-cache fills gaps for any stats not covered by GQL
  const merged = { ...lb, ...gql };
  if (Object.keys(merged).length >= 4) {
    return merged;
  }
  console.log(`[tour-avg] gql+lb-cache returned only ${Object.keys(merged).length} stats, falling back to ESPN computed`);


  // Fallback: compute mean from all PGA Tour player ESPN overview stats
  try {
    return await computeFromAllPlayers();
  } catch (err) {
    console.log(`[tour-avg] espn-computed fallback failed: ${err}`);
    return {};
  }
}
