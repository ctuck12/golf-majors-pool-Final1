export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonResults } from '@/app/lib/espn-player-season';

export type { SeasonResult } from '@/app/lib/espn-player-season';

const CACHE_TTL = 432000; // 120 hours

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ results: null });

  const cacheKey = `player-season:2026:${name}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ results: JSON.parse(cached) });

    const results = await fetchPlayerSeasonResults(name);

    if (results.length > 0) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
    }
    return Response.json({ results: results.length > 0 ? results : null });
  } catch {
    return Response.json({ results: null });
  }
}
