export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonStats, fetchPlayerTournamentStats } from '@/app/lib/espn-player-stats';

export type { PlayerStats } from '@/app/lib/espn-player-stats';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const context = searchParams.get('context') ?? 'season';
  const eventId = searchParams.get('eventId') ?? '';

  if (!name) return Response.json({ stats: null });

  const isTournament = context === 'tournament' && eventId;
  const cacheKey = isTournament
    ? `player-stats:v2:tourn:${eventId}:${name}`
    : `player-stats:v2:season:2026:${name}`;
  const ttl = isTournament ? 1800 : 86400;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ stats: JSON.parse(cached) });

    const stats = isTournament
      ? await fetchPlayerTournamentStats(name, eventId)
      : await fetchPlayerSeasonStats(name);

    if (stats) {
      await redis.setex(cacheKey, ttl, JSON.stringify(stats));
    }
    return Response.json({ stats });
  } catch {
    return Response.json({ stats: null });
  }
}
