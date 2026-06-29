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
  const seasonYear = new Date().getFullYear();
  const cacheKey = isTournament
    ? `player-stats:v34:tourn:${eventId}:${name}`
    : `player-stats:v61:season:${seasonYear}:${name}`;
  const ranksCacheKey = isTournament
    ? `player-stats:v34:tourn:${eventId}:${name}${RANKS_CACHE_SUFFIX}`
    : `player-stats:v61:season:${seasonYear}:${name}${RANKS_CACHE_SUFFIX}`;
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
        'Drive Dist': 'drivingDistance', 'Drive Acc': 'drivingAccuracy', 'Putts/Green': 'puttAverage',
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
      pgaTourId ? fetchPgaTourPlayerStats(pgaTourId, name) : Promise.resolve(null),
      fetchPlayerSeasonStats(name),
    ]);

    const pgaStats = pgaResult?.stats ?? null;
    const pgaRanks: PlayerStatRanks = pgaResult?.ranks ?? {};

    // ESPN ranks win for driving stats (ESPN values are more reliable there).
    // Scrambling rank is NOT included here — playerProfileStats rank for stat 106 is wrong,
    // and ESPN overview rank is also based on their wrong formula. The rank will be absent
    // until the stat-leaderboard route computes it from ESPN Core types/2.
    const ESPN_LABEL_TO_FIELD: Record<string, string> = {
      'Sand Saves%': 'sandSaves',
      'GIR%': 'gir',
      'Drive Dist': 'drivingDistance',
      'Drive Acc': 'drivingAccuracy',
      'Putts/Green': 'puttAverage',
      'Birdies/Rd': 'birdiesPerRound',
    };
    const espnLabelRanks = espnStats?.statRanks ?? {};
    const mergedSeasonRanks: PlayerStatRanks = { ...pgaRanks };
    for (const [label, rankStr] of Object.entries(espnLabelRanks)) {
      const field = ESPN_LABEL_TO_FIELD[label];
      if (!field || !rankStr) continue;
      const num = parseInt(rankStr);
      if (isNaN(num) || num <= 0) continue;
      mergedSeasonRanks[field] = String(num);
    }
    // Override SG ranks with leaderboard-derived ranks (more accurate than playerProfileStats).
    // The leaderboard popup uses the same cache, so this makes player card ranks match exactly.
    const SG_STAT_KEYS = ['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting'];
    const lbRankResults = await Promise.allSettled(
      SG_STAT_KEYS.map(k => redis.get(`stat-lb:v25:${k}`))
    );
    const nameLower = name.toLowerCase();
    for (let i = 0; i < SG_STAT_KEYS.length; i++) {
      const result = lbRankResults[i];
      if (result.status !== 'fulfilled' || !result.value) continue;
      try {
        const parsed = JSON.parse(result.value as string);
        const entries: { rank: number; name: string }[] = parsed.entries ?? parsed;
        const entry = entries.find(e => e.name.toLowerCase() === nameLower);
        if (entry) mergedSeasonRanks[SG_STAT_KEYS[i]] = String(entry.rank);
      } catch { /* ignore */ }
    }

    const ranks: PlayerStatRanks | null = Object.keys(mergedSeasonRanks).length > 0 ? mergedSeasonRanks : null;

    // ESPN wins the merge for most stats. For scrambling, espnStats now uses averageDisplayValue
    // which may contain the correct value; pgaStats is used only as a last-resort fallback
    // (playerProfileStats stat 130 returns an internal metric that doesn't match pgatour.com).
    const merged = (espnStats || pgaStats) ? mergeStats(pgaStats, espnStats) : null;
    if (merged && pgaStats && !espnStats?.scrambling) {
      if (pgaStats.scrambling) merged.scrambling = pgaStats.scrambling;
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
