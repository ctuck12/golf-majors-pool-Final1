export type StatAverages = Partial<Record<string, string>>;

// Stat IDs to fetch from statdata.pgatour.com
const FETCH_STATS: Array<{ key: string; statId: string; suffix?: string; multiplier?: number }> = [
  { key: 'drivingDistance', statId: '101' },
  { key: 'drivingAccuracy', statId: '102', suffix: '%' },
  { key: 'gir', statId: '103', suffix: '%' },
  { key: 'scrambling', statId: '130', suffix: '%' },
  { key: 'scoringAverage', statId: '108' },
  { key: 'avgPuttsPerRound', statId: '104', multiplier: 18 }, // putts/GIR → putts/round
];

// SG stats are always 0 by definition (relative to field)
const SG_ZERO_KEYS = ['sgTotal', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting'];

async function fetchStatAvg(statId: string, year: number): Promise<string | null> {
  try {
    const res = await fetch(`https://statdata.pgatour.com/r/${year}/stats/${statId}.json`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'Referer': 'https://www.pgatour.com/' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { tourAvg?: string; stat?: { tourAvg?: string } };
    return data?.tourAvg ?? data?.stat?.tourAvg ?? null;
  } catch {
    return null;
  }
}

export async function fetchTourAverages(): Promise<StatAverages> {
  const year = new Date().getFullYear();
  const results: StatAverages = {};

  // SG averages are always 0
  for (const key of SG_ZERO_KEYS) {
    results[key] = '0.000';
  }

  await Promise.all(
    FETCH_STATS.map(async ({ key, statId, suffix, multiplier }) => {
      const raw = await fetchStatAvg(statId, year);
      if (!raw) return;
      let val = raw.trim();
      if (multiplier) {
        const num = parseFloat(val);
        if (!isNaN(num)) val = (num * multiplier).toFixed(1);
      }
      if (suffix && !val.endsWith(suffix)) val = `${val}${suffix}`;
      results[key] = val;
    })
  );

  return results;
}
