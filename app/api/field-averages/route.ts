export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const STAT_KEYS = [
  'drivingDistance', 'drivingAccuracy', 'gir', 'scrambling',
  'avgPuttsPerRound', 'puttAverage', 'scoringAverage',
] as const;

const FIELD_AVG_TTL = 1800; // 30 minutes

function parseNumeric(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace('%', ''));
  return isNaN(n) ? null : n;
}

function formatLike(avg: number, sample: string): string {
  if (sample.endsWith('%')) return `${avg.toFixed(1)}%`;
  if (sample.includes('.')) {
    const decimals = sample.split('.')[1]?.length ?? 1;
    return avg.toFixed(Math.min(decimals, 2));
  }
  return avg.toFixed(1);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId') ?? '';
  if (!eventId) return Response.json({ averages: {} });

  const cacheKey = `player-stats:field-avg:v1:${eventId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ averages: JSON.parse(cached) });

    // Scan Redis for all cached player stats for this tournament
    const pattern = `player-stats:v12:tourn:${eventId}:*`;
    const playerKeys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;
      playerKeys.push(...keys);
    } while (cursor !== '0');

    if (playerKeys.length < 3) return Response.json({ averages: {} });

    // Fetch all player stats in parallel
    const rawValues = await Promise.all(playerKeys.map((k) => redis.get(k)));

    // Accumulate totals per stat
    const totals: Record<string, { sum: number; count: number; sample: string }> = {};

    for (const raw of rawValues) {
      if (!raw) continue;
      try {
        const stats = JSON.parse(raw) as Record<string, string | null>;
        for (const key of STAT_KEYS) {
          let rawVal = stats[key] ?? null;
          // puttAverage → avgPuttsPerRound conversion (putts/GIR × 18)
          if (key === 'avgPuttsPerRound' && !rawVal && stats.puttAverage) {
            const n = parseNumeric(stats.puttAverage);
            if (n !== null) rawVal = (n * 18).toFixed(1);
          }
          const n = parseNumeric(rawVal);
          if (n === null || n === 0) continue;
          if (!totals[key]) totals[key] = { sum: 0, count: 0, sample: rawVal! };
          totals[key].sum += n;
          totals[key].count += 1;
        }
      } catch {
        // skip malformed
      }
    }

    const averages: Record<string, string> = {};
    for (const [key, { sum, count, sample }] of Object.entries(totals)) {
      if (count < 3) continue;
      averages[key] = formatLike(sum / count, sample);
    }

    if (Object.keys(averages).length > 0) {
      await redis.setex(cacheKey, FIELD_AVG_TTL, JSON.stringify(averages));
    }

    return Response.json({ averages });
  } catch {
    return Response.json({ averages: {} });
  }
}
