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
    ? `player-stats:v10:tourn:${eventId}:${name}`
    : `player-stats:v6:season:2026:${name}`;
  const ttl = isTournament ? 1800 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ stats: JSON.parse(cached) });

    if (isTournament) {
      // Fetch ESPN tournament stats and PGA Tour scorecard stats in parallel
      const meta = getTournamentMetaByEspnId(eventId);
      const pgaTournId = meta ? pgaTourTournId(meta.slashGolfTournId, meta.year) : null;

      const [espnStats, pgaScorecardStats, pgaSeasonStats, espnSeasonStats] = await Promise.all([
        fetchPlayerTournamentStats(name, eventId),
        pgaTourId && pgaTournId ? fetchPgaScorecardStats(pgaTournId, pgaTourId) : Promise.resolve(null),
        pgaTourId ? fetchPgaTourPlayerStats(pgaTourId) : Promise.resolve(null),
        fetchPlayerSeasonStats(name),
      ]);

      // Priority (lowest → highest):
      // 1. ESPN season stats — reliable base for course stats (no SG)
      // 2. PGA Tour season stats — adds season SG; fills course stats for no-ShotLink events
      // 3. ESPN tournament stats — tournament-specific driving/GIR/rounds override season
      // 4. PGA scorecard SG — tournament-specific SG (Players, PGA, Open; not Masters/US Open)
      // null from a higher-priority source never overwrites a non-null lower-priority value.
      const stats = espnStats || pgaScorecardStats || pgaSeasonStats || espnSeasonStats
        ? mergeStats(espnSeasonStats, pgaSeasonStats, espnStats, pgaScorecardStats)
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
