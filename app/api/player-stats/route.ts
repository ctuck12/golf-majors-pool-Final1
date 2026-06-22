export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonStats, fetchPlayerTournamentStats } from '@/app/lib/espn-player-stats';
import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';
import { fetchPgaScorecardStats, pgaTourTournId } from '@/app/lib/pga-scorecard-stats';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';

export type { PlayerStats } from '@/app/lib/espn-player-stats';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const context = searchParams.get('context') ?? 'season';
  const eventId = searchParams.get('eventId') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  if (!name) return Response.json({ stats: null });

  const isTournament = context === 'tournament' && eventId;
  const cacheKey = isTournament
    ? `player-stats:v6:tourn:${eventId}:${name}`
    : `player-stats:v5:season:2026:${name}`;
  const ttl = isTournament ? 1800 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ stats: JSON.parse(cached) });

    if (isTournament) {
      // Fetch ESPN tournament stats and PGA Tour scorecard stats in parallel
      const meta = getTournamentMetaByEspnId(eventId);
      const pgaTournId = meta ? pgaTourTournId(meta.slashGolfTournId, meta.year) : null;

      const [espnStats, pgaScorecardStats] = await Promise.all([
        fetchPlayerTournamentStats(name, eventId),
        pgaTourId && pgaTournId ? fetchPgaScorecardStats(pgaTournId, pgaTourId) : Promise.resolve(null),
      ]);

      // Merge: ESPN provides base (driving, GIR, putts, rounds), PGA scorecard overrides/adds SG
      const stats = espnStats || pgaScorecardStats
        ? { ...(espnStats ?? {}), ...(pgaScorecardStats ?? {}) }
        : null;

      if (stats) {
        await redis.setex(cacheKey, ttl, JSON.stringify(stats));
      }
      return Response.json({ stats });
    }

    // Season context: try PGA Tour first, then ESPN, merge with PGA Tour taking priority
    const [pgaStats, espnStats] = await Promise.all([
      pgaTourId ? fetchPgaTourPlayerStats(pgaTourId) : Promise.resolve(null),
      fetchPlayerSeasonStats(name),
    ]);

    // ESPN provides the base shape; PGA Tour overrides shared fields and adds SG fields
    const stats = espnStats || pgaStats
      ? { ...(espnStats ?? {}), ...(pgaStats ?? {}) }
      : null;

    if (stats) {
      await redis.setex(cacheKey, ttl, JSON.stringify(stats));
    }
    return Response.json({ stats });
  } catch {
    return Response.json({ stats: null });
  }
}
