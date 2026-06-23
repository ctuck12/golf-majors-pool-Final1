export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonStats, fetchPlayerTournamentStats } from '@/app/lib/espn-player-stats';
import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';
import type { PlayerStatRanks } from '@/app/lib/pga-player-stats';
import { fetchPgaScorecardStats, pgaTourTournId } from '@/app/lib/pga-scorecard-stats';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';

export type { PlayerStats } from '@/app/lib/espn-player-stats';

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

const RANKS_CACHE_SUFFIX = ':ranks';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const context = searchParams.get('context') ?? 'season';
  const eventId = searchParams.get('eventId') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  if (!name) return Response.json({ stats: null, ranks: null });

  const isTournament = context === 'tournament' && eventId;
  const cacheKey = isTournament
    ? `player-stats:v15:tourn:${eventId}:${name}`
    : `player-stats:v10:season:2026:${name}`;
  const ranksCacheKey = `player-stats:v10:season:2026:${name}${RANKS_CACHE_SUFFIX}`;
  const ttl = isTournament ? 1800 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const ranksRaw = await redis.get(ranksCacheKey);
      const ranks = ranksRaw ? JSON.parse(ranksRaw) : null;
      return Response.json({ stats: JSON.parse(cached), ranks });
    }

    if (isTournament) {
      const meta = getTournamentMetaByEspnId(eventId);
      const pgaTournId = meta ? pgaTourTournId(meta.slashGolfTournId, meta.year) : null;

      const [espnStats, scorecardResult, pgaResult, espnSeasonStats] = await Promise.all([
        fetchPlayerTournamentStats(name, eventId),
        pgaTourId && pgaTournId ? fetchPgaScorecardStats(pgaTournId, pgaTourId) : Promise.resolve(null),
        pgaTourId ? fetchPgaTourPlayerStats(pgaTourId) : Promise.resolve(null),
        fetchPlayerSeasonStats(name),
      ]);

      const pgaScorecardStats = scorecardResult?.stats ?? null;
      const pgaSeasonStats = pgaResult?.stats ?? null;

      const stats = espnStats || pgaScorecardStats || pgaSeasonStats || espnSeasonStats
        ? mergeStats(espnSeasonStats, pgaSeasonStats, espnStats, pgaScorecardStats)
        : null;

      // Tournament SG ranks come from scorecardStatsV3 strokesGained.rank (tournament-specific)
      // Season course stat ranks come from playerProfileStats (PGA Tour season)
      const seasonRanks = pgaResult?.ranks ?? {};
      const tournSgRanks = scorecardResult?.sgRanks ?? {};
      const mergedRanks = { ...seasonRanks, ...tournSgRanks };

      if (stats) {
        await redis.setex(cacheKey, ttl, JSON.stringify(stats));
      }
      return Response.json({ stats, ranks: Object.keys(mergedRanks).length > 0 ? mergedRanks : null });
    }

    // Season context
    const [pgaResult, espnStats] = await Promise.all([
      pgaTourId ? fetchPgaTourPlayerStats(pgaTourId) : Promise.resolve(null),
      fetchPlayerSeasonStats(name),
    ]);

    const pgaStats = pgaResult?.stats ?? null;
    const ranks: PlayerStatRanks | null = pgaResult?.ranks ?? null;

    const stats = espnStats || pgaStats
      ? mergeStats(espnStats, pgaStats)
      : null;

    if (stats) {
      await redis.setex(cacheKey, ttl, JSON.stringify(stats));
    }
    if (ranks && Object.keys(ranks).length > 0) {
      await redis.setex(ranksCacheKey, ttl, JSON.stringify(ranks));
    }
    return Response.json({ stats, ranks });
  } catch {
    return Response.json({ stats: null, ranks: null });
  }
}
