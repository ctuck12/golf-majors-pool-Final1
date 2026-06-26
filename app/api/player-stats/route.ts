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

// PGA Tour IDs for players whose pool name differs from PGA Tour records
const PGA_TOUR_ID_BY_NAME: Record<string, string> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const context = searchParams.get('context') ?? 'season';
  const eventId = searchParams.get('eventId') ?? '';
  const rawPgaTourId = searchParams.get('pgaTourId') ?? '';
  const pgaTourId = (rawPgaTourId && rawPgaTourId !== '0') ? rawPgaTourId : (PGA_TOUR_ID_BY_NAME[name] ?? '');

  if (!name) return Response.json({ stats: null, ranks: null });

  const isTournament = context === 'tournament' && eventId;
  const cacheKey = isTournament
    ? `player-stats:v28:tourn:${eventId}:${name}`
    : `player-stats:v34:season:2026:${name}`;
  const ranksCacheKey = isTournament
    ? `player-stats:v28:tourn:${eventId}:${name}${RANKS_CACHE_SUFFIX}`
    : `player-stats:v34:season:2026:${name}${RANKS_CACHE_SUFFIX}`;
  const ttl = isTournament ? 900 : 3600;

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
      // Strip ALL SG ranks from season in tournament context — tournament SG ranks must only
      // come from scorecardStatsV3 (tournSgRanks). Season SG ranks must never bleed into
      // tournament view even if the scorecard returned no ranks for a particular category.
      const { sgTotal: _i1, sgOffTee: _i2, sgApproach: _i3, sgAroundGreen: _i4, sgPutting: _i5, ...seasonNonSgRanks } = seasonRanks;
      // ESPN season ranks as base fallback for players without PGA Tour GQL data (LIV/DP World)
      const ESPN_LABEL_TO_FIELD_TOURN: Record<string, string> = {
        'Scrambling%': 'scrambling', 'Sand Saves%': 'sandSaves', 'GIR%': 'gir',
        'Drive Dist': 'drivingDistance', 'Drive Acc': 'drivingAccuracy', 'Putts/Round': 'avgPuttsPerRound',
      };
      const espnSeasonRanks: Record<string, string> = {};
      for (const [label, field] of Object.entries(ESPN_LABEL_TO_FIELD_TOURN)) {
        const rankStr = (espnSeasonStats?.statRanks as Record<string, string> | null)?.[label];
        if (rankStr) { const num = parseInt(rankStr); if (!isNaN(num) && num > 0) espnSeasonRanks[field] = String(num); }
      }
      const mergedRanks = { ...espnSeasonRanks, ...seasonNonSgRanks, ...tournSgRanks };

      if (stats) {
        await redis.setex(cacheKey, ttl, JSON.stringify(stats));
      }
      const tournRanksToCache = Object.keys(mergedRanks).length > 0 ? mergedRanks : null;
      if (tournRanksToCache) {
        await redis.setex(ranksCacheKey, ttl, JSON.stringify(tournRanksToCache));
      }
      return Response.json({ stats, ranks: tournRanksToCache });
    }

    // Season context
    const [pgaResult, espnStats] = await Promise.all([
      pgaTourId ? fetchPgaTourPlayerStats(pgaTourId) : Promise.resolve(null),
      fetchPlayerSeasonStats(name),
    ]);

    const pgaStats = pgaResult?.stats ?? null;
    const pgaRanks: PlayerStatRanks = pgaResult?.ranks ?? {};

    // ESPN ranks win for driving stats (ESPN values are more reliable there).
    // PGA Tour GQL ranks win for GIR/scrambling/sandSaves — ESPN uses a different formula
    // that produces wrong values and ranks for these three stats.
    const ESPN_LABEL_TO_FIELD: Record<string, string> = {
      'Sand Saves%': 'sandSaves',
      'Scrambling%': 'scrambling',
      'GIR%': 'gir',
      'Drive Dist': 'drivingDistance',
      'Drive Acc': 'drivingAccuracy',
      'Putts/Round': 'avgPuttsPerRound',
      'Birdies/Rd': 'birdiesPerRound',
    };
    // Stats where PGA Tour GQL rank is authoritative — do not let ESPN override when PGA has a value
    const PGA_AUTHORITATIVE = new Set(['scrambling', 'sandSaves']);
    const espnLabelRanks = espnStats?.statRanks ?? {};
    const mergedSeasonRanks: PlayerStatRanks = { ...pgaRanks };
    for (const [label, rankStr] of Object.entries(espnLabelRanks)) {
      const field = ESPN_LABEL_TO_FIELD[label];
      if (!field || !rankStr) continue;
      const num = parseInt(rankStr);
      if (isNaN(num) || num <= 0) continue;
      // Don't overwrite PGA Tour rank for GIR/scrambling/sandSaves — ESPN formula is unreliable
      if (PGA_AUTHORITATIVE.has(field) && mergedSeasonRanks[field]) continue;
      mergedSeasonRanks[field] = String(num);
    }
    const ranks: PlayerStatRanks | null = Object.keys(mergedSeasonRanks).length > 0 ? mergedSeasonRanks : null;

    // ESPN wins the merge for most stats (more reliable driving distance/accuracy values).
    // But override GIR/scrambling/sandSaves back to PGA Tour GQL values when available —
    // ESPN computes these with a different formula that produces incorrect percentages.
    const merged = (espnStats || pgaStats) ? mergeStats(pgaStats, espnStats) : null;
    if (merged && pgaStats) {
      if (pgaStats.scrambling) merged.scrambling = pgaStats.scrambling;
      if (pgaStats.sandSaves) merged.sandSaves = pgaStats.sandSaves;
    }
    const stats = merged;

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
