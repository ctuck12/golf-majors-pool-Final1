export type StatAverages = Record<string, string>;

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

function statNumericSafe(stats: Stat[], def: typeof COMPUTED_STAT_DEFS[0]): number | null {
  const s = stats.find((x) => x.name === def.espnName);
  if (!s) return null;
  // For sandSaves the percentage lives in the average field, not value
  if (def.useAvgField) {
    if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
    const av = parseFloat(s.averageDisplayValue ?? '');
    if (!isNaN(av) && av !== 0) return av;
    return null;
  }
  // For percentage stats, displayValue has the correct per-round/percentage number;
  // value field may be a raw season count (e.g. total greens hit)
  if (def.isPercent) {
    const dv = parseFloat((s.displayValue ?? '').replace('%', ''));
    if (!isNaN(dv) && dv !== 0) return dv;
  }
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  const dv2 = parseFloat((s.displayValue ?? '').replace('%', ''));
  if (!isNaN(dv2) && dv2 !== 0) return dv2;
  return null;
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

async function fetchOverviewStats(espnId: string): Promise<Stat[] | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as { seasonRankings?: { categories?: Stat[] }; summaryStatistics?: Stat[] };
    const merged = [...(data?.seasonRankings?.categories ?? []), ...(data?.summaryStatistics ?? [])];
    return merged.length > 0 ? merged : null;
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
  const allStats = await batchAll(ids.map((id) => () => fetchOverviewStats(id)), BATCH_SIZE);

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  // Log all stat names from first player to diagnose missing stats
  const firstStats = allStats.find(Boolean);
  if (firstStats) {
    console.log(`[tour-avg] sample stat names: ${JSON.stringify(firstStats.map(s => s.name))}`);
    console.log(`[tour-avg] sample gir stat: ${JSON.stringify(firstStats.find(s => s.name === 'gir'))}`);
    console.log(`[tour-avg] sample scrambling stat: ${JSON.stringify(firstStats.find(s => s.name === 'scrambling') ?? firstStats.find(s => s.name === 'scramblingPct'))}`);
    console.log(`[tour-avg] sample sandSaves stat: ${JSON.stringify(firstStats.find(s => s.name === 'sandSaves') ?? firstStats.find(s => s.name === 'sandSavePct'))}`);
  }

  for (const stats of allStats) {
    if (!stats) continue;
    const seen = new Set<string>();
    for (const def of COMPUTED_STAT_DEFS) {
      if (seen.has(def.key)) continue;
      let raw = statNumericSafe(stats, def);
      if (raw === null) continue;
      if (def.altMultiplier) raw = raw * def.altMultiplier;
      sums[def.key] = (sums[def.key] ?? 0) + raw;
      counts[def.key] = (counts[def.key] ?? 0) + 1;
      seen.add(def.key);
    }
  }

  const results: StatAverages = {};
  for (const key of Object.keys(sums)) {
    const avg = sums[key] / counts[key];
    results[key] = formatAvg(avg, key);
    console.log(`[tour-avg] key=${key} source=computed avg=${results[key]} n=${counts[key]}`);
  }
  return results;
}

export async function fetchTourAverages(): Promise<StatAverages> {
  // Primary: PGA Tour GQL statDetails tourAvg (official tour average, may lag slightly)
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
