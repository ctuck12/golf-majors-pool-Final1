export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

// Tour averages are read directly from the stat-lb caches (the same source as the leaderboard
// popups) so player stat cards and leaderboard popups always show identical Tour Avg values.
// stat-lb:v28 is refreshed every 50 min by the warm-stat-caches cron.

const STAT_LB_PREFIX = 'stat-lb:v28:';
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

export async function GET() {
  try {
    const results = await Promise.all(
      STAT_KEYS.map(k => redis.get(`${STAT_LB_PREFIX}${k}`))
    );

    const averages: Record<string, string> = {};
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const raw = results[i];
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const avg = parsed.tourAvg;
        if (avg !== null && avg !== undefined) averages[STAT_KEYS[i]] = String(avg);
      } catch { /* ignore */ }
    }

    return Response.json({ averages });
  } catch {
    return Response.json({ averages: {} });
  }
}
