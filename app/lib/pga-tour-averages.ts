export type StatAverages = Record<string, string>;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

// 2026 PGA Tour season hardcoded fallback averages
const FALLBACK_AVERAGES: StatAverages = {
  drivingDistance: '298.4',
  drivingAccuracy: '61.9%',
  gir: '65.2%',
  scrambling: '59.1%',
  sandSaves: '55.8%',
  scoringAverage: '70.54',
  avgPuttsPerRound: '29.4',
};

// Stat IDs and their PlayerStats field names + formatting
const STAT_MAP: Array<{ statId: string; key: string; suffix?: string; multiplier?: number }> = [
  { statId: '101', key: 'drivingDistance' },
  { statId: '102', key: 'drivingAccuracy', suffix: '%' },
  { statId: '103', key: 'gir', suffix: '%' },
  { statId: '130', key: 'scrambling', suffix: '%' },
  { statId: '107', key: 'sandSaves', suffix: '%' },
  { statId: '108', key: 'scoringAverage' },
  { statId: '104', key: 'avgPuttsPerRound', multiplier: 18 }, // putts/GIR → putts/round
];

async function fetchStatTourAvg(statId: string): Promise<string | null> {
  try {
    const query = `
      query StatDetails($statId: ID!) {
        statDetails(statId: $statId) {
          tourAvg
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/',
        'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables: { statId } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { statDetails?: { tourAvg?: string } } };
    return data?.data?.statDetails?.tourAvg ?? null;
  } catch {
    return null;
  }
}

export async function fetchTourAverages(): Promise<StatAverages> {
  const results: StatAverages = { ...FALLBACK_AVERAGES };

  await Promise.all(
    STAT_MAP.map(async ({ statId, key, suffix, multiplier }) => {
      const raw = await fetchStatTourAvg(statId);
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
