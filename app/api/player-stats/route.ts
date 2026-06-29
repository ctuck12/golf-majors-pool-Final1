export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonStats, fetchPlayerTournamentStats } from '@/app/lib/espn-player-stats';
import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';
import type { PlayerStatRanks } from '@/app/lib/pga-player-stats';
import { fetchPgaScorecardStats, pgaTourTournId } from '@/app/lib/pga-scorecard-stats';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { resolvePgaTourIdByName } from '@/app/lib/pga-id-resolver';

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
  let pgaTourId = (rawPgaTourId && rawPgaTourId !== '0') ? rawPgaTourId : (PGA_TOUR_ID_BY_NAME[name] ?? '');

  if (!name) return Response.json({ stats: null, ranks: null });

  const isTournament = context === 'tournament' && eventId;
  // Season context: when the pool record has no PGA Tour ID (0), resolve it by name from the PGA
  // Tour player directory so SG, scrambling, and their ranks still populate. ~37 pool players
  // (Finau, Power, Eckroat, Hoge, etc.) ship with pgaTourId 0 and would otherwise lose these stats.
  if (!isTournament && !pgaTourId) {
    pgaTourId = (await resolvePgaTourIdByName(name)) ?? '';
  }
  const seasonYear = new Date().getFullYear();
  const cacheKey = isTournament
    ? `player-stats:v34:tourn:${eventId}:${name}`
    : `player-stats:v84:season:${seasonYear}:${name}`;
  const ranksCacheKey = isTournament
    ? `player-stats:v34:tourn:${eventId}:${name}${RANKS_CACHE_SUFFIX}`
    : `player-stats:v84:season:${seasonYear}:${name}${RANKS_CACHE_SUFFIX}`;
  const ttl = isTournament ? 900 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached && isTournament) {
      const ranksRaw = await redis.get(ranksCacheKey);
      const ranks = ranksRaw ? JSON.parse(ranksRaw) : null;
      return Response.json({ stats: JSON.parse(cached), ranks });
    }
    // A PGA Tour player (has pgaTourId) whose cached stats lack SG is a poisoned entry from a
    // transient PGA GQL failure. Ignore it and fall through to a fresh fetch so it self-heals,
    // rather than serving the incomplete blob (the cached path can't restore SG when stat-lb is cold).
    const cachedSeasonUsable = (() => {
      if (!cached || isTournament) return false;
      if (!pgaTourId) return true; // non-PGA player: SG legitimately absent, cache is fine
      try { return !!JSON.parse(cached).sgTotal; } catch { return false; }
    })();
    if (cachedSeasonUsable) {
      // For season context: recompute ranks from stat-lb so player card ranks match
      // popup leaderboard positions. For any stat where stat-lb is cold, fall back to
      // previously-cached ranks so a partial cron failure never leaves ranks blank.
      const LB_STAT_KEYS_EARLY = [
        'drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'birdiesPerRound',
        'scrambling', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
      ];
      const normNameEarly = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
      const nameLowerEarly = normNameEarly(name);
      const [lbResultsEarly, ranksRaw] = await Promise.all([
        Promise.allSettled(LB_STAT_KEYS_EARLY.map(k => redis.get(`stat-lb:v28:${k}`))),
        redis.get(ranksCacheKey).catch(() => null),
      ]);
      // Cached ranks are the fallback — only used per-key when stat-lb is genuinely cold (null).
      // When stat-lb is warm it is always authoritative; never let a stale cached rank win.
      const cachedRanks: Record<string, string> = ranksRaw ? JSON.parse(ranksRaw as string) : {};
      const LB_WINS_KEYS_EARLY = new Set(['gir', 'puttAverage', 'scrambling', 'drivingAccuracy', 'drivingDistance', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting']);
      const PERCENT_KEYS_EARLY = new Set(['gir', 'scrambling', 'drivingAccuracy']);
      const freshRanks: Record<string, string> = {};
      const cachedStats = JSON.parse(cached as string);
      for (let i = 0; i < LB_STAT_KEYS_EARLY.length; i++) {
        const result = lbResultsEarly[i];
        const key = LB_STAT_KEYS_EARLY[i];
        if (result.status !== 'fulfilled' || !result.value) {
          // stat-lb cold — use last known rank as fallback so rank doesn't disappear
          if (cachedRanks[key]) freshRanks[key] = cachedRanks[key];
          continue;
        }
        // stat-lb warm — authoritative; never fall back to cached rank for this key
        try {
          const parsed = JSON.parse(result.value as string);
          const entries: { rank: number; name: string; value?: string | number }[] = parsed.entries ?? parsed;
          const entryIndex = entries.findIndex(e => normNameEarly(e.name) === nameLowerEarly);
          if (entryIndex === -1) {
            // Warm but player not on this leaderboard (LIV / non-PGA-Tour player). Keep the last
            // known rank from the ranks cache — which holds their PGA Tour profile rank — so their
            // SG ranks don't vanish on cached reads.
            if (cachedRanks[key]) freshRanks[key] = cachedRanks[key];
            continue;
          }
          const entry = entries[entryIndex];
          // Use list position (not entry.rank) — popup renders by list order, so this always matches
          freshRanks[key] = String(entryIndex + 1);
          if (LB_WINS_KEYS_EARLY.has(key) && entry.value != null) {
            const raw = String(entry.value).replace('%', '');
            if (PERCENT_KEYS_EARLY.has(key)) {
              // Round to 1 decimal so player card matches leaderboard popup display
              const num = parseFloat(raw);
              cachedStats[key] = !isNaN(num) ? `${(Math.round(num * 10) / 10).toFixed(1)}%` : `${raw}%`;
            } else {
              cachedStats[key] = raw;
            }
          }
        } catch { /* ignore */ }
      }
      const ranks = Object.keys(freshRanks).length > 0 ? freshRanks : null;
      return Response.json({ stats: cachedStats, ranks });
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

    // RANKS — single source of truth: the stat-leaderboard caches (stat-lb), which are the EXACT
    // data the leaderboard popups render. The card always uses list position (findIndex+1) from
    // that same data, so a card rank can never disagree with the popup. We deliberately do NOT use
    // PGA Tour "official" ranks (pgaResult.ranks) or ESPN ranks here: they use a different field
    // and denominator and were the recurring source of card-vs-popup mismatch (they only leaked in
    // when a stat's stat-lb cache went cold). When a stat's stat-lb cache is momentarily cold we
    // fall back to the last list-position rank we cached — the same ranking system — never to a
    // foreign rank source.
    const LB_STAT_KEYS = [
      'drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'birdiesPerRound',
      'scrambling', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
    ];
    const [lbRankResults, ranksRaw] = await Promise.all([
      Promise.allSettled(LB_STAT_KEYS.map(k => redis.get(`stat-lb:v28:${k}`))),
      redis.get(ranksCacheKey).catch(() => null),
    ]);
    const cachedRanks: Record<string, string> = ranksRaw ? JSON.parse(ranksRaw as string) : {};
    const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
    const nameLower = normName(name);
    let lbScrambling: { value: string; rank: string } | null = null;
    const lbStatValues: Record<string, string> = {};
    const mergedSeasonRanks: PlayerStatRanks = {};
    for (let i = 0; i < LB_STAT_KEYS.length; i++) {
      const key = LB_STAT_KEYS[i];
      const result = lbRankResults[i];
      if (result.status !== 'fulfilled' || !result.value) {
        // stat-lb cold for this stat — keep the last list-position rank (same system as the popup)
        if (cachedRanks[key]) mergedSeasonRanks[key] = cachedRanks[key];
        continue;
      }
      try {
        const parsed = JSON.parse(result.value as string);
        const entries: { rank: number; name: string; value?: string | number }[] = parsed.entries ?? parsed;
        const entryIdx = entries.findIndex(e => normName(e.name) === nameLower);
        if (entryIdx === -1) continue; // warm but player not on this leaderboard — popup wouldn't rank them either
        const entry = entries[entryIdx];
        const listRank = String(entryIdx + 1); // list position — exactly what the popup displays
        if (key === 'scrambling') {
          lbScrambling = { rank: listRank, value: entry.value ? String(entry.value) : '' };
          mergedSeasonRanks[key] = listRank;
        } else {
          mergedSeasonRanks[key] = listRank;
          if (entry.value !== undefined && entry.value !== null) lbStatValues[key] = String(entry.value);
        }
      } catch { /* ignore */ }
    }

    // Gap-fill from the PGA Tour profile rank (playerProfileStats) for any stat that stat-lb did
    // NOT rank. This only ever fires for LIV / non-PGA-Tour players (Rahm, Cam Smith, Hatton, etc.):
    // they don't play the PGA Tour, so they're absent from every stat-lb leaderboard and would
    // otherwise show their SG values with no rank. PGA Tour players are in stat-lb, so the
    // list-position rank already won above and still matches the popup exactly — this never
    // overrides it. (For LIV players there is no popup to mismatch, so the profile rank is correct.)
    const pgaRanks: PlayerStatRanks = pgaResult?.ranks ?? {};
    for (const [key, rank] of Object.entries(pgaRanks)) {
      if (rank && !mergedSeasonRanks[key]) mergedSeasonRanks[key] = rank;
    }

    const ranks: PlayerStatRanks | null = Object.keys(mergedSeasonRanks).length > 0 ? mergedSeasonRanks : null;

    // ESPN wins the merge for most stats. For scrambling, prefer the ESPN leaderboard cache value
    // (same source as the in-app scrambling leaderboard popup) over PGA Tour statDetails which
    // omits some players. Fall back to pgaStats scrambling only as last resort.
    // Keys where stat-lb is always the canonical value source (same source as popup leaderboards).
    // gir and puttAverage added so player card value+rank always matches the popup exactly.
    const LB_WINS_KEYS = new Set(['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting', 'gir', 'puttAverage', 'scrambling', 'drivingAccuracy', 'drivingDistance']);
    const merged = (espnStats || pgaStats) ? mergeStats(pgaStats, espnStats) : null;
    if (merged) {
      if (lbScrambling?.value) {
        const v = lbScrambling.value;
        merged.scrambling = v.endsWith('%') ? v : `${v}%`;
      } else if (pgaStats?.scrambling && !espnStats?.scrambling) {
        merged.scrambling = pgaStats.scrambling;
      }
      for (const [key, value] of Object.entries(lbStatValues)) {
        if (LB_WINS_KEYS.has(key) || !merged[key]) merged[key] = value;
      }
    }

    const stats = merged;

    // Only cache a COMPLETE result. SG and scrambling come from PGA Tour GQL (pgaStats) or from
    // warm SG stat-lb caches. If a transient PGA GQL failure leaves them absent, caching the
    // partial result would poison every subsequent read for a full hour (the cached path can't
    // restore SG/scrambling when the SG stat-lb caches are cold). So only write when the result
    // actually carries SG + scrambling. A player who genuinely has neither (e.g. LIV/DP World with
    // no PGA Tour data) simply re-fetches each time, which is correct.
    const pgaHadStats = !!pgaStats && Object.keys(pgaStats).length > 0;
    const resultComplete = !!(stats && stats.sgTotal && stats.scrambling);
    if (stats && (resultComplete || !pgaHadStats)) {
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
