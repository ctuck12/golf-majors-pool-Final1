export type StatAverages = Record<string, string>;

// ESPN overview already includes averageDisplayValue / average on each stat — the tour average.
// Fetch one player's overview (any active PGA Tour player) and extract those fields.
// Rory McIlroy ESPN ID — reliable active player
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const SAMPLE_ESPN_ID = '3698';

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

// Each entry maps an ESPN stat name to a StatAverages key + optional suffix and multiplier
const AVG_MAP: Array<{ espnName: string; key: string; suffix?: string; multiplier?: number }> = [
  { espnName: 'yardsPerDrive', key: 'drivingDistance' },
  { espnName: 'driveAccuracyPct', key: 'drivingAccuracy', suffix: '%' },
  { espnName: 'greensInRegPct', key: 'gir', suffix: '%' },
  { espnName: 'gir', key: 'gir', suffix: '%' },
  { espnName: 'scramblingPct', key: 'scrambling', suffix: '%' },
  { espnName: 'scrambling', key: 'scrambling', suffix: '%' },
  { espnName: 'sandSaves', key: 'sandSaves', suffix: '%' },
  { espnName: 'sandSavePct', key: 'sandSaves', suffix: '%' },
  { espnName: 'puttsPerRound', key: 'avgPuttsPerRound' },
  { espnName: 'puttsGirAvg', key: 'avgPuttsPerRound', multiplier: 18 },
  { espnName: 'scoringAverage', key: 'scoringAverage' },
  { espnName: 'adjScoringAvg', key: 'scoringAverage' },
];

function extractAvg(s: Stat, suffix?: string, multiplier?: number): string | null {
  // averageDisplayValue is the tour average ESPN embeds alongside each player's stat
  let raw = s.averageDisplayValue ?? (s.average != null ? String(s.average) : null);
  if (!raw || raw === '-' || raw === '--') return null;
  let num = parseFloat(raw.replace('%', ''));
  if (isNaN(num) || num === 0) return null;
  if (multiplier) num = num * multiplier;
  const str = num.toFixed(num % 1 === 0 ? 1 : (String(num).split('.')[1]?.length ?? 1));
  if (suffix && !str.endsWith(suffix)) return `${str}${suffix}`;
  return str;
}

export async function fetchTourAverages(): Promise<StatAverages> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${SAMPLE_ESPN_ID}/overview`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`ESPN overview HTTP ${res.status}`);
    const data = await res.json() as { seasonRankings?: { categories?: Stat[] }; summaryStatistics?: Stat[] };
    const cats: Stat[] = data?.seasonRankings?.categories ?? [];
    const sumStats: Stat[] = data?.summaryStatistics ?? [];
    const all = [...cats, ...sumStats];

    const results: StatAverages = {};
    for (const { espnName, key, suffix, multiplier } of AVG_MAP) {
      if (results[key]) continue; // already found for this key
      const s = all.find((st) => st.name === espnName);
      if (!s) continue;
      const val = extractAvg(s, suffix, multiplier);
      if (val) {
        console.log(`[tour-avg] key=${key} espnName=${espnName} value=${val}`);
        results[key] = val;
      }
    }
    return results;
  } catch (err) {
    console.log(`[tour-avg] ESPN overview fetch failed: ${err}`);
    return {};
  }
}
