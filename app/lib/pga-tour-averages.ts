import { fetchPlayerSeasonStats } from './espn-player-stats';

export type StatAverages = Record<string, string>;

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_EVENT_IDS = ['401811952', '401811947', '401811941'];
const BATCH_SIZE = 25;

// statAvgs labels from espn-player-stats → StatAverages keys
const LABEL_TO_KEY: Record<string, string> = {
  'Drive Dist': 'drivingDistance',
  'Drive Acc': 'drivingAccuracy',
  'GIR%': 'gir',
  'Scrambling%': 'scrambling',
  'Sand Saves%': 'sandSaves',
  'Putts/Round': 'avgPuttsPerRound',
};

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

const LOWER_IS_BETTER = new Set(['avgPuttsPerRound']);

const STAT_DEFS: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number; altMultiplier?: number }> = [
  { key: 'drivingDistance', espnName: 'yardsPerDrive', decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensInRegPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensHit', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scramblingPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambling', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSavePct', isPercent: true, decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsPerRound', decimals: 1 },
  { key: 'avgPuttsPerRound', espnName: 'puttsGirAvg', decimals: 1, altMultiplier: 18 },
];

function statNumeric(stats: Stat[], name: string): number | null {
  const s = stats.find((x) => x.name === name);
  if (!s) return null;
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  const dv = parseFloat(s.displayValue ?? '');
  if (!isNaN(dv) && dv !== 0) return dv;
  if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
  const av = parseFloat(s.averageDisplayValue ?? '');
  if (!isNaN(av) && av !== 0) return av;
  return null;
}

function formatAvg(v: number, key: string): string {
  const def = STAT_DEFS.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

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
  return Array.from(idSet);
}

async function fetchOverviewStats(espnId: string): Promise<Stat[] | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as { seasonRankings?: { categories?: Stat[] }; summaryStatistics?: Stat[] };
    const cats = data?.seasonRankings?.categories ?? [];
    const sumStats = data?.summaryStatistics ?? [];
    const merged = [...cats, ...sumStats];
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

  for (const stats of allStats) {
    if (!stats) continue;
    const seen = new Set<string>();
    for (const def of STAT_DEFS) {
      if (seen.has(def.key)) continue;
      let raw = statNumeric(stats, def.espnName);
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
  // Primary: ESPN statAvgs from a known player's overview (tour average is the same for all players)
  try {
    const stats = await fetchPlayerSeasonStats('Rory McIlroy');
    const statAvgs = stats?.statAvgs ?? {};
    const results: StatAverages = {};
    for (const [label, key] of Object.entries(LABEL_TO_KEY)) {
      const val = statAvgs[label];
      if (val) {
        console.log(`[tour-avg] key=${key} source=statAvgs value=${val}`);
        results[key] = val;
      }
    }
    if (Object.keys(results).length > 0) return results;
    console.log('[tour-avg] statAvgs empty, falling back to computed');
  } catch (err) {
    console.log(`[tour-avg] statAvgs failed: ${err}, falling back to computed`);
  }

  // Fallback: compute mean from all PGA Tour player overview stats
  try {
    return await computeFromAllPlayers();
  } catch (err) {
    console.log(`[tour-avg] computed fallback failed: ${err}`);
    return {};
  }
}
