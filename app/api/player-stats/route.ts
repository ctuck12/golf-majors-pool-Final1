export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonStats, fetchPlayerTournamentStats } from '@/app/lib/espn-player-stats';
import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';
import { fetchPgaScorecardStats, pgaTourTournId } from '@/app/lib/pga-scorecard-stats';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';

export type { PlayerStats } from '@/app/lib/espn-player-stats';

// Merge stats sources in priority order; null from a higher-priority source
// does NOT overwrite a non-null value from a lower-priority source.
function mergeStats(...sources: (Record<string, unknown> | null)[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [k, v] of Object.entries(source)) {
      if (v !== null && v !== undefined) result[k] = v;
    }
  }
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const context = searchParams.get('context') ?? 'season';
  const eventId = searchParams.get('eventId') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  if (!name) return Response.json({ stats: null });

  const isTournament = context === 'tournament' && eventId;
  const cacheKey = isTournament
    ? `player-stats:v9:tourn:${eventId}:${name}`
    : `player-stats:v5:season:2026:${name}`;
  const ttl = isTournament ? 1800 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ stats: JSON.parse(cached) });

    if (isTournament) {
      // Fetch ESPN tournament stats and PGA Tour scorecard stats in parallel
      const meta = getTournamentMetaByEspnId(eventId);
      const pgaTournId = meta ? pgaTourTournId(meta.slashGolfTournId, meta.year) : null;

      const [espnStats, pgaScorecardStats, pgaSeasonStats] = await Promise.all([
        fetchPlayerTournamentStats(name, eventId),
        pgaTourId && pgaTournId ? fetchPgaScorecardStats(pgaTournId, pgaTourId) : Promise.resolve(null),
        pgaTourId ? fetchPgaTourPlayerStats(pgaTourId) : Promise.resolve(null),
      ]);

      // Merge in priority order: season stats as base (fills course stats + SG for events
      // without ShotLink like Masters/US Open, or for cut players missing scorecard SG),
      // then ESPN tournament stats (tournament-specific driving/GIR override season),
      // then PGA scorecard SG (highest priority — tournament-specific SG when available).
      // null from a higher-priority source never overwrites a non-null lower-priority value.
      const stats = espnStats || pgaScorecardStats || pgaSeasonStats
        ? mergeStats(pgaSeasonStats, espnStats, pgaScorecardStats)
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
      ? mergeStats(espnStats, pgaStats)
      : null;

    if (stats) {
      await redis.setex(cacheKey, ttl, JSON.stringify(stats));
    }
    return Response.json({ stats });
  } catch {
    return Response.json({ stats: null });
  }
}
