export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

// Tour averages are read from stat-lb:v28 caches when warm.
// When a stat-lb key is cold (e.g. right after a cache version bump), the route
// falls back to fetching the official tour average directly from PGA Tour statDetails GQL.
// This keeps tour averages visible even when no leaderboard popups have been opened yet.

const STAT_LB_PREFIX = 'stat-lb:v28:';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const STAT_KEYS = [
  'drivingDistance',
  'drivingAccuracy',
  'gir',
  'scrambling',
  'sandSaves',
  'puttAverage',
  'scoringAverage',
  'sgTotal',
  'sgOffTee',
  'sgApproach',
  'sgAroundGreen',
  'sgPutting',
  'sgTeeToGreen',
];

// Primary PGA Tour stat ID for each key (used for fallback tour avg fetch)
const STAT_IDS: Record<string, string> = {
  drivingDistance: '101',
  drivingAccuracy: '102',
  gir: '103',
  puttAverage: '104',
  scoringAverage: '108',
  scrambling: '130',
  sandSaves: '111',
  sgTotal: '02675',
  sgTeeToGreen: '02674',
  sgOffTee: '02567',
  sgApproach: '02568',
  sgAroundGreen: '02569',
  sgPutting: '02564',
};

async function fetchTourAvgFromPga(statId: string): Promise<string | null> {
  try {
    const query = `query StatDetails($statId: String!) {
      statDetails(tourCode: R, statId: $statId) {
        rows { ... on StatDetailTourAvg { value } }
      }
    }`;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/',
        'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables: { statId } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { statDetails?: { rows?: Array<{ value?: string }> } } };
    const rows = data?.data?.statDetails?.rows ?? [];
    for (const row of rows) {
      if (row.value) return row.value;
    }
    return null;
  } catch { return null; }
}

export async function GET() {
  try {
    const results = await Promise.all(
      STAT_KEYS.map(k => redis.get(`${STAT_LB_PREFIX}${k}`))
    );

    const averages: Record<string, string> = {};
    const coldKeys: string[] = [];

    for (let i = 0; i < STAT_KEYS.length; i++) {
      const raw = results[i];
      if (!raw) { coldKeys.push(STAT_KEYS[i]); continue; }
      try {
        const parsed = JSON.parse(raw);
        const avg = parsed.tourAvg;
        if (avg !== null && avg !== undefined) {
          averages[STAT_KEYS[i]] = String(avg);
        } else {
          coldKeys.push(STAT_KEYS[i]);
        }
      } catch { coldKeys.push(STAT_KEYS[i]); }
    }

    // Fallback: fetch official tour averages directly from PGA Tour for any cold stat
    if (coldKeys.length > 0) {
      const fallbacks = await Promise.all(
        coldKeys.map(k => STAT_IDS[k] ? fetchTourAvgFromPga(STAT_IDS[k]) : Promise.resolve(null))
      );
      for (let i = 0; i < coldKeys.length; i++) {
        if (fallbacks[i]) averages[coldKeys[i]] = fallbacks[i]!;
      }
    }

    return Response.json({ averages });
  } catch {
    return Response.json({ averages: {} });
  }
}
