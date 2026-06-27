export const dynamic = 'force-dynamic';

// Cron job: warm stat leaderboard caches so they're always fresh for users.
// Runs every hour via vercel.json cron schedule.
// Hits /api/stat-leaderboard for each stat key and /api/tour-averages.

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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const results: Record<string, string> = {};

  // Warm tour averages
  try {
    const res = await fetch(`${baseUrl}/api/tour-averages`, { cache: 'no-store' });
    results['tour-averages'] = res.ok ? 'ok' : `${res.status}`;
  } catch (e) {
    results['tour-averages'] = String(e);
  }

  // Warm each stat leaderboard sequentially to avoid hammering ESPN
  for (const key of STAT_KEYS) {
    try {
      const res = await fetch(`${baseUrl}/api/stat-leaderboard?statKey=${key}`, { cache: 'no-store' });
      results[key] = res.ok ? 'ok' : `${res.status}`;
    } catch (e) {
      results[key] = String(e);
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('[warm-stat-caches] results:', results);
  return Response.json({ results });
}
