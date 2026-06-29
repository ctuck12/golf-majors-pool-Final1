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
    : `player-stats:v73:season:${seasonYear}:${name}`;
  const ranksCacheKey = isTournament
    ? `player-stats:v34:tourn:${eventId}:${name}${RANKS_CACHE_SUFFIX}`
    : `player-stats:v73:season:${seasonYear}:${name}${RANKS_CACHE_SUFFIX}`;
  const ttl = isTournament ? 900 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached && isTournament) {
      const ranksRaw = await redis.get(ranksCacheKey);
      const ranks = ranksRaw ? JSON.parse(ranksRaw) : null;
      return Response.json({ stats: JSON.parse(cached), ranks });
    }
    if (cached && !isTournament) {
      // For season context: always recompute ranks from stat-lb so player card ranks match
      // popup leaderboard positions. Never return stale ESPN-sourced cached ranks.
      const LB_STAT_KEYS_EARLY = [
        'drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'birdiesPerRound',
        'scrambling', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
      ];
      const normNameEarly = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
      const nameLowerEarly = normNameEarly(name);
      const lbResultsEarly = await Promise.allSettled(
        LB_STAT_KEYS_EARLY.map(k => redis.get(`stat-lb:v28:${k}`))
      );
      const freshRanks: Record<string, string> = {};
      for (let i = 0; i < LB_STAT_KEYS_EARLY.length; i++) {
        const result = lbResultsEarly[i];
        if (result.status !== 'fulfilled' || !result.value) continue;
        try {
          const parsed = JSON.parse(result.value as string);
          const entries: { rank: number; name: string }[] = parsed.entries ?? parsed;
          const entry = entries.find(e => normNameEarly(e.name) === nameLowerEarly);
          if (entry) freshRanks[LB_STAT_KEYS_EARLY[i]] = String(entry.rank);
        } catch { /* ignore */ }
      }
      const ranks = Object.keys(freshRanks).length > 0 ? freshRanks : null;
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
    // Use stat-lb cache as the authoritative rank source for ALL stats so popup ranks always
    // match leaderboard positions. stat-lb is the single source of truth for both.
    const LB_STAT_KEYS = [
      'drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'birdiesPerRound',
      'scrambling', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
    ];
    const lbRankResults = await Promise.allSettled(
      LB_STAT_KEYS.map(k => redis.get(`stat-lb:v28:${k}`))
    );
    const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
    const nameLower = normName(name);
    let lbScrambling: { value: string; rank: string } | null = null;
    const lbStatValues: Record<string, string> = {};
    for (let i = 0; i < LB_STAT_KEYS.length; i++) {
      const result = lbRankResults[i];
      if (result.status !== 'fulfilled' || !result.value) continue;
      try {
        const parsed = JSON.parse(result.value as string);
        const entries: { rank: number; name: string; value?: string | number }[] = parsed.entries ?? parsed;
        const entry = entries.find(e => normName(e.name) === nameLower);
        if (!entry) continue;
        const key = LB_STAT_KEYS[i];
        if (key === 'scrambling') {
          lbScrambling = { rank: String(entry.rank), value: entry.value ? String(entry.value) : '' };
        } else {
          mergedSeasonRanks[key] = String(entry.rank);
          if (entry.value !== undefined && entry.value !== null) lbStatValues[key] = String(entry.value);
        }
      } catch { /* ignore */ }
    }
    if (lbScrambling) mergedSeasonRanks['scrambling'] = lbScrambling.rank;

    const ranks: PlayerStatRanks | null = Object.keys(mergedSeasonRanks).length > 0 ? mergedSeasonRanks : null;

    // ESPN wins the merge for most stats. For scrambling, prefer the ESPN leaderboard cache value
    // (same source as the in-app scrambling leaderboard popup) over PGA Tour statDetails which
    // omits some players. Fall back to pgaStats scrambling only as last resort.
    const SG_LB_KEYS = new Set(['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting']);
    const merged = (espnStats || pgaStats) ? mergeStats(pgaStats, espnStats) : null;
    if (merged) {
      if (lbScrambling?.value) {
        const v = lbScrambling.value;
        merged.scrambling = v.endsWith('%') ? v : `${v}%`;
      } else if (pgaStats?.scrambling && !espnStats?.scrambling) {
        merged.scrambling = pgaStats.scrambling;
      }
      // stat-lb (statDetails endpoint) is the canonical source for SG values — always override
      // playerProfileStats GQL which updates on a different schedule. For non-SG stats, stat-lb
      // only fills in values that ESPN/PGA Tour didn't provide (ESPN wins for those).
      for (const [key, value] of Object.entries(lbStatValues)) {
        if (SG_LB_KEYS.has(key) || !merged[key]) merged[key] = value;
      }
    }

    const stats = merged;

    // Guard: if stat-lb returned no SG values at all, the SG leaderboard caches are cold and
    // any SG values in `merged` came from PGA Tour GQL (a different update schedule). Don't cache
    // in that case — the next request will retry and hopefully find warm stat-lb caches.
    const sgLbWarm = Object.keys(lbStatValues).some(k => SG_LB_KEYS.has(k));
    if (stats && sgLbWarm) {
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
