export const dynamic = 'force-dynamic';

// Cron job: warm stat leaderboard caches so they're always fresh for users.
// Runs every hour via vercel.json cron schedule.
// Hits /api/stat-leaderboard for each stat key and /api/tour-averages.
//
// Stats are fetched in parallel batches of 4 so a single slow stat can't
// cause the function to time out before the others are warmed.

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

const BATCH_SIZE = 4;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const results: Record<string, string> = {};

  // Warm tour averages first
  try {
    const res = await fetch(`${baseUrl}/api/tour-averages`, { cache: 'no-store' });
    results['tour-averages'] = res.ok ? 'ok' : `${res.status}`;
  } catch (e) {
    results['tour-averages'] = String(e);
  }

  // Warm stat leaderboards in parallel batches — each batch runs concurrently,
  // batches run sequentially so we don't hammer ESPN all at once.
  for (let i = 0; i < STAT_KEYS.length; i += BATCH_SIZE) {
    const batch = STAT_KEYS.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (key) => {
        try {
          const res = await fetch(`${baseUrl}/api/stat-leaderboard?statKey=${key}&bust=1`, {
            cache: 'no-store',
            headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
          });
          results[key] = res.ok ? 'ok' : `${res.status}`;
        } catch (e) {
          results[key] = String(e);
        }
      })
    );
  }

  console.log('[warm-stat-caches] results:', results);
  return Response.json({ results });
}
