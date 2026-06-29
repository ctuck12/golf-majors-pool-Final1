export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

// Small batches: each stat-leaderboard build does ~216 ESPN supplement calls plus PGA GQL, so
// running too many at once overloads the upstream APIs and some builds come back empty (HTTP 200
// but zero entries) and never cache — leaving those stats cold. 2 at a time keeps builds reliable.
const BATCH_SIZE = 2;
const MAX_ATTEMPTS = 3;

export async function GET(request: Request) {
  // Vercel only injects the `Authorization: Bearer <CRON_SECRET>` header on scheduled invocations
  // when CRON_SECRET is configured in the project env. If it is NOT set, the cron fires with no
  // auth header — and a strict `!== Bearer undefined` check returns 401 every time, which was the
  // bug that left every stat-lb cache cold (the cron never actually ran). So only enforce auth when
  // a secret is configured; otherwise allow the invocation. This endpoint only warms public stat
  // caches, so allowing it unauthenticated when no secret is set is low risk.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

  // Warm stat leaderboards in small parallel batches. A build "succeeds" only if it returns a
  // non-empty entries array — a 200 with zero entries means the upstream call failed under load and
  // the cache was NOT written, so we retry. Without this check the cron reported "ok" while leaving
  // stat-lb caches cold, which is why player-card ranks went missing.
  for (let i = 0; i < STAT_KEYS.length; i += BATCH_SIZE) {
    const batch = STAT_KEYS.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (key) => {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const res = await fetch(`${baseUrl}/api/stat-leaderboard?statKey=${key}&bust=1`, {
              cache: 'no-store',
              headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
            });
            if (res.ok) {
              const data = await res.json().catch(() => null) as { entries?: unknown[] } | null;
              if (Array.isArray(data?.entries) && data!.entries.length > 0) {
                results[key] = `ok(${data!.entries.length})`;
                return;
              }
              results[key] = `empty:attempt${attempt}`;
            } else {
              results[key] = `${res.status}:attempt${attempt}`;
            }
          } catch (e) {
            results[key] = `err:attempt${attempt}:${String(e)}`;
          }
        }
      })
    );
  }

  console.log('[warm-stat-caches] results:', results);
  return Response.json({ results });
}
