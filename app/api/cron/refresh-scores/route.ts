export const dynamic = 'force-dynamic';

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import {
  fetchLeaderboard,
  fetchScorecard,
  parseMongo,
  type SlashGolfLeaderboardRow,
  type SlashGolfLeaderboardResponse,
} from '@/app/lib/slashgolf';
import { fetchESPNTournament } from '@/app/lib/espn';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import {
  getScorecardCache,
  saveScorecardCache,
  mergeScorecardCache,
  getRoundLeaderStore,
  saveRoundLeader,
  getLowRoundStore,
  saveLowRound,
  readLeaderboardCache,
  writeLeaderboardCache,
  normName,
  type StoredPlayerScorecards,
} from '@/app/lib/scorecard-store';
import {
  getSelectedPlayerIdsForTournament,
  autoLockPoolLineup,
  TOURNAMENT_IDS,
  type TournamentId,
} from '@/app/lib/pool-store';
import redis from '@/app/lib/redis';


// ── Field parsing (same helpers as before) ────────────────────────────────

function normalizePosition(row: SlashGolfLeaderboardRow): string {
  return String(row.position ?? '--');
}

function getRoundStrokes(row: SlashGolfLeaderboardRow, roundNum: number): number | null {
  const rnd = row.rounds?.find((r) => parseMongo(r.roundId) === roundNum);
  if (!rnd) return null;
  const s = parseMongo(rnd.strokes);
  return s > 0 ? s : null;
}

function isRoundComplete(roundStatus: string): boolean {
  const s = roundStatus.toLowerCase();
  return s === 'complete' || s === 'official' || s === 'final';
}

function extractProjectedCut(lb: SlashGolfLeaderboardResponse): string | null {
  return lb.cutLines?.[0]?.cutScore ?? null;
}

// Cut positions: number of players who make the cut (top N + ties)
const ESPN_CUT_POSITIONS: Partial<Record<string, number>> = {
  players: 65,
  masters: 50,
  pga: 70,
  'us-open': 60,
  open: 70,
};

const EXPLICIT_CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

function parseScoreToNum(s: string | undefined): number {
  if (!s || s === '--') return 999;
  if (s === 'E') return 0;
  const n = parseInt(String(s), 10);
  return isNaN(n) ? 999 : n;
}

function computeProjectedCutFromRows(tournamentId: string, rows: SlashGolfLeaderboardRow[], currentRound: number): string | null {
  if (currentRound !== 2) return null; // only meaningful during R2
  const cutPos = ESPN_CUT_POSITIONS[tournamentId];
  if (!cutPos) return null;
  const active = rows
    .filter(r => !EXPLICIT_CUT_STATUSES.has((r.total ?? '').toUpperCase()) && r.total && r.total !== '--')
    .sort((a, b) => parseScoreToNum(a.total) - parseScoreToNum(b.total));
  if (active.length < cutPos) return null;
  return active[cutPos - 1]?.total ?? null;
}

// ESPN does not always set competitor.score = 'CUT' after round 2 — they may leave numeric scores
// on cut players. When round 2 is official and no cut players are already flagged, derive the cut
// from score order using the configured cut positions (top N + ties).
function applyEspnCutStatuses(
  tournamentId: string,
  rows: SlashGolfLeaderboardRow[],
  currentRound: number,
  roundComplete: boolean,
): SlashGolfLeaderboardRow[] {
  // Apply whenever round 2 is definitively complete: either we're on round 2 Official,
  // or we've advanced past round 2 (missed-round recovery and live round 3+).
  const round2Complete = (currentRound === 2 && roundComplete) || currentRound > 2;
  if (!round2Complete) return rows;
  const cutPos = ESPN_CUT_POSITIONS[tournamentId];
  if (!cutPos) return rows;

  // If ESPN already explicitly flagged some players as CUT/MDF, trust their data
  const hasCutPlayers = rows.some(r =>
    r.status?.toLowerCase() === 'cut' || r.status?.toLowerCase() === 'mdf' ||
    EXPLICIT_CUT_STATUSES.has((r.total ?? '').toUpperCase()),
  );
  if (hasCutPlayers) return rows;

  // Sort eligible players (exclude WD/DQ) by 36-hole score to find the cut line
  const WITHDRAW_STATUSES = new Set(['WD', 'DQ']);
  const eligible = rows
    .filter(r => !WITHDRAW_STATUSES.has((r.status ?? '').toUpperCase()) && !WITHDRAW_STATUSES.has((r.total ?? '').toUpperCase()))
    .sort((a, b) => parseScoreToNum(a.total) - parseScoreToNum(b.total));

  if (eligible.length <= cutPos) return rows; // Field smaller than cut position — no cut

  // The cut line is the score at position cutPos (0-indexed: cutPos - 1).
  // "Top N and ties" means all players AT that score make it; only strictly worse scores miss.
  const cutScore = parseScoreToNum(eligible[cutPos - 1]?.total);

  return rows.map(r => {
    // Don't override explicit WD/DQ statuses
    if (WITHDRAW_STATUSES.has((r.status ?? '').toUpperCase()) || WITHDRAW_STATUSES.has((r.total ?? '').toUpperCase())) return r;
    if (parseScoreToNum(r.total) > cutScore) {
      return { ...r, status: 'cut', position: 'CUT' };
    }
    return r;
  });
}

// ── Scorecard refresh helpers ─────────────────────────────────────────────

async function captureLowRound(
  tournamentId: string,
  roundId: number,
  rows: SlashGolfLeaderboardRow[],
) {
  const scores = rows
    .map((r) => getRoundStrokes(r, roundId))
    .filter((s): s is number => s !== null);
  if (scores.length) await saveLowRound(tournamentId, roundId, Math.min(...scores));
}

async function captureRoundLeader(
  tournamentId: string,
  roundId: number,
  rows: SlashGolfLeaderboardRow[],
) {
  const leaders = rows.filter((r) => {
    const pos = normalizePosition(r);
    return pos === '1' || pos === 'T1';
  });
  if (!leaders.length) return;
  const names = leaders.map((r) => `${r.firstName} ${r.lastName}`);
  const leadScore = Number(String(leaders[0].total ?? '0').replace('+', '')) || 0;
  await saveRoundLeader(tournamentId, roundId, names, leadScore);
}

async function refreshScorecards(
  tournamentId: string,
  slashGolfTournId: string,
  year: string,
  rows: SlashGolfLeaderboardRow[],
  currentRound: number,
): Promise<void> {
  const rowByName = new Map<string, SlashGolfLeaderboardRow>();
  for (const row of rows) rowByName.set(normName(`${row.firstName} ${row.lastName}`), row);

  const players: Record<string, StoredPlayerScorecards> = {};
  for (const poolPlayer of PLAYER_POOL_WITH_PGA_IDS) {
    const row = rowByName.get(normName(poolPlayer.name));
    if (!row?.playerId) continue;
    try {
      const rounds = await fetchScorecard(slashGolfTournId, year, row.playerId);
      const stored = rounds
        .filter((r) => r.roundComplete)
        .map((r) => ({
          roundId: parseMongo(r.roundId),
          holes: Object.entries(r.holes ?? {})
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, h]) => ({
              holeNumber: parseMongo(h.holeId),
              par: parseMongo(h.par),
              score: parseMongo(h.holeScore),
            }))
            .filter((h) => h.par > 0 && h.score > 0),
        }));
      players[row.playerId] = {
        playerId: row.playerId,
        playerName: poolPlayer.name,
        rounds: stored,
        refreshedAt: new Date().toISOString(),
      };
    } catch { /* not in field */ }
  }
  await saveScorecardCache(tournamentId, players, currentRound);
}

async function refreshLiveScorecards(
  tournamentId: string,
  slashGolfTournId: string,
  year: string,
  rows: SlashGolfLeaderboardRow[],
  selectedPoolIds: Set<number>,
): Promise<void> {
  const rowByName = new Map<string, SlashGolfLeaderboardRow>();
  for (const row of rows) rowByName.set(normName(`${row.firstName} ${row.lastName}`), row);

  const updatedPlayers: Record<string, StoredPlayerScorecards> = {};
  for (const poolPlayer of PLAYER_POOL_WITH_PGA_IDS) {
    if (!selectedPoolIds.has(poolPlayer.id)) continue;
    const row = rowByName.get(normName(poolPlayer.name));
    if (!row?.playerId) continue;
    const status = String(row.status ?? '').toLowerCase();
    if (status === 'cut' || status === 'wd' || status === 'dq') continue;
    const thru = String(row.thru ?? '').trim() || '--';
    if (thru === 'F' || thru === '--') continue;

    try {
      const roundsRaw = await fetchScorecard(slashGolfTournId, year, row.playerId);
      const stored = roundsRaw.map((r) => ({
        roundId: parseMongo(r.roundId),
        holes: Object.entries(r.holes ?? {})
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, h]) => ({
            holeNumber: parseMongo(h.holeId),
            par: parseMongo(h.par),
            score: parseMongo(h.holeScore),
          }))
          .filter((h) => h.par > 0 && h.score > 0),
      }));
      updatedPlayers[row.playerId] = {
        playerId: row.playerId,
        playerName: poolPlayer.name,
        rounds: stored,
        refreshedAt: new Date().toISOString(),
      };
    } catch { /* not in field */ }
  }
  if (Object.keys(updatedPlayers).length > 0) {
    await mergeScorecardCache(tournamentId, updatedPlayers);
  }
}

// ── Per-tournament refresh ────────────────────────────────────────────────

async function markTournamentComplete(
  tournamentId: string,
  existing: Awaited<ReturnType<typeof readLeaderboardCache>>,
  rows: SlashGolfLeaderboardRow[],
  currentRound: number,
  roundStatus: string,
  projectedCut: string | null,
): Promise<void> {
  await writeLeaderboardCache(tournamentId, {
    cachedAt: existing?.cachedAt ?? new Date().toISOString(),
    leaderboard: rows,
    currentRound,
    roundStatus,
    projectedCut,
    tournamentComplete: true,
  });
}

async function refreshTournamentFromESPN(
  tournamentId: string,
  espnEventId: string,
  existing: Awaited<ReturnType<typeof readLeaderboardCache>>,
  wasNotStarted = false,
): Promise<string> {
  let espnResult: Awaited<ReturnType<typeof fetchESPNTournament>>;
  try {
    espnResult = await fetchESPNTournament(espnEventId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('400')) {
      // Only write notStarted if we have no existing leaderboard data — a 400 between rounds
      // (ESPN doesn't include the event on that date) must not wipe already-fetched round data.
      const hasExistingData = (existing?.leaderboard?.length ?? 0) > 0;
      if (!hasExistingData) {
        await writeLeaderboardCache(tournamentId, {
          cachedAt: new Date().toISOString(),
          leaderboard: [],
          currentRound: 0,
          roundStatus: '',
          projectedCut: null,
          notStarted: true,
        });
        return 'not-started';
      }
      return 'espn-400-preserved-cache';
    }
    throw err;
  }

  // First successful fetch after notStarted — auto-lock picks so nobody sneaks in a late change
  if (wasNotStarted && TOURNAMENT_IDS.includes(tournamentId as TournamentId)) {
    await autoLockPoolLineup(tournamentId as TournamentId);
  }

  const { currentRound, roundStatus, playerScorecards } = espnResult;
  const roundComplete = isRoundComplete(roundStatus);
  // Apply cut statuses when ESPN hasn't flagged them explicitly (ESPN keeps numeric scores on cut players)
  const rows = applyEspnCutStatuses(tournamentId, espnResult.leaderboardRows, currentRound, roundComplete);
  const projectedCut = computeProjectedCutFromRows(tournamentId, rows, currentRound);

  await writeLeaderboardCache(tournamentId, {
    cachedAt: new Date().toISOString(),
    leaderboard: rows,
    currentRound,
    roundStatus,
    projectedCut,
  });

  const [scorecardCache, lowRoundStore] = await Promise.all([
    getScorecardCache(tournamentId),
    getLowRoundStore(),
  ]);

  const lastCompleted = scorecardCache?.lastCompletedRound ?? 0;
  const needsFullRefresh = roundComplete && lastCompleted < currentRound;

  if (needsFullRefresh) {
    await captureLowRound(tournamentId, currentRound, rows);
    if (currentRound <= 3) await captureRoundLeader(tournamentId, currentRound, rows);

    // Backfill low rounds from current data (ESPN has all round strokes in one response)
    for (let rndId = 1; rndId < currentRound; rndId++) {
      if (!lowRoundStore[tournamentId]?.[String(rndId)]) {
        await captureLowRound(tournamentId, rndId, rows);
      }
    }

    // All scorecard data comes embedded in the ESPN fetch — no per-player API calls needed
    await saveScorecardCache(tournamentId, playerScorecards, currentRound);

    if (currentRound >= 4) {
      await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
      return 'tournament-complete-marked';
    }

    return `round-${currentRound}-complete-refreshed`;
  }

  if (roundComplete && currentRound >= 4 && lastCompleted >= currentRound) {
    await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
    return 'tournament-complete-marked';
  }

  // Missed-round recovery: if ESPN moved currentRound forward without us ever seeing
  // roundStatus='Official' for the previous round (the cron missed the brief post-round
  // window before the next round's pre-tournament state began), process it now.
  // ESPN embeds all completed round data in every response, so playerScorecards is complete.
  if (!roundComplete && currentRound > lastCompleted + 1) {
    const prevRound = currentRound - 1;
    await captureLowRound(tournamentId, prevRound, rows);
    if (prevRound <= 3) await captureRoundLeader(tournamentId, prevRound, rows);
    for (let rndId = lastCompleted + 1; rndId < prevRound; rndId++) {
      if (!lowRoundStore[tournamentId]?.[String(rndId)]) {
        await captureLowRound(tournamentId, rndId, rows);
      }
    }
    await saveScorecardCache(tournamentId, playerScorecards, prevRound);
    return `round-${prevRound}-complete-recovered`;
  }

  // Live round — merge all player scorecards from embedded ESPN data (no per-player calls)
  if (!roundComplete && Object.keys(playerScorecards).length > 0) {
    await mergeScorecardCache(tournamentId, playerScorecards);
    return 'live-scorecards-refreshed';
  }

  return 'leaderboard-refreshed';
}

async function refreshTournament(tournamentId: string): Promise<string> {
  const meta = TOURNAMENT_META[tournamentId];
  if (!meta) return 'unknown-tournament';

  const existing = await readLeaderboardCache(tournamentId);

  // Permanently done — skip forever, all data is in Redis
  if (existing?.tournamentComplete) return 'tournament-complete-skipped';

  // not-started TTL handles its own backoff, UNLESS we're past the lock time —
  // then force a fresh fetch so the transition to live doesn't stall for 30 min.
  const wasNotStarted = !!existing?.notStarted;
  if (wasNotStarted) {
    const pastLock = meta.lockAtUtc && Date.now() >= new Date(meta.lockAtUtc).getTime();
    if (!pastLock) return 'not-started-cached';
    // Clear the stale notStarted entry so the fetch below proceeds cleanly.
    await redis.del(`leaderboard-cache:${tournamentId}`);
  }

  // ESPN path — one fetch returns both leaderboard and all scorecard data
  if (meta.dataSource === 'espn' && meta.espnEventId) {
    return refreshTournamentFromESPN(tournamentId, meta.espnEventId, existing, wasNotStarted);
  }

  let lb: SlashGolfLeaderboardResponse;
  try {
    lb = await fetchLeaderboard(meta.slashGolfTournId, meta.year);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('400') && msg.toLowerCase().includes('not found')) {
      await writeLeaderboardCache(tournamentId, {
        cachedAt: new Date().toISOString(),
        leaderboard: [],
        currentRound: 0,
        roundStatus: '',
        projectedCut: null,
        notStarted: true,
      });
      return 'not-started';
    }
    throw err;
  }

  const rows = lb.leaderboardRows ?? [];
  const currentRound = parseMongo(lb.roundId);
  const roundStatus = lb.roundStatus ?? lb.status ?? '';
  const projectedCut = extractProjectedCut(lb);

  await writeLeaderboardCache(tournamentId, {
    cachedAt: new Date().toISOString(),
    leaderboard: rows,
    currentRound,
    roundStatus,
    projectedCut,
  });

  // ── Completed-round bookkeeping ─────────────────────────────────────────
  const scorecardCache = await getScorecardCache(tournamentId);
  const roundLeaderStore = await getRoundLeaderStore();
  const lowRoundStore = await getLowRoundStore();

  const roundComplete = isRoundComplete(roundStatus);
  const needsFullRefresh = roundComplete && (scorecardCache?.lastCompletedRound ?? 0) < currentRound;

  if (needsFullRefresh) {
    await captureLowRound(tournamentId, currentRound, rows);
    if (currentRound <= 3) await captureRoundLeader(tournamentId, currentRound, rows);

    // Backfill any prior rounds whose data is missing
    for (let rndId = 1; rndId < currentRound; rndId++) {
      if (!lowRoundStore[tournamentId]?.[String(rndId)]) {
        await captureLowRound(tournamentId, rndId, rows);
      }
      if (rndId <= 3 && !roundLeaderStore[tournamentId]?.[String(rndId)]) {
        try {
          const histLb = await fetchLeaderboard(meta.slashGolfTournId, meta.year, rndId);
          await captureRoundLeader(tournamentId, rndId, histLb.leaderboardRows ?? []);
        } catch { /* not available */ }
      }
    }

    await refreshScorecards(tournamentId, meta.slashGolfTournId, meta.year, rows, currentRound);

    // Round 4 just finished — all data is now cached; stop polling forever
    if (currentRound >= 4) {
      await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
      return 'tournament-complete-marked';
    }

    return `round-${currentRound}-complete-refreshed`;
  }

  // If round 4 is already complete and scorecards are current, mark and stop
  if (roundComplete && currentRound >= 4 && (scorecardCache?.lastCompletedRound ?? 0) >= currentRound) {
    await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
    return 'tournament-complete-marked';
  }

  // ── Live scorecard refresh for active rounds ────────────────────────────
  if (!roundComplete && TOURNAMENT_IDS.includes(tournamentId as TournamentId)) {
    const selectedPoolIds = await getSelectedPlayerIdsForTournament(tournamentId as TournamentId);
    if (selectedPoolIds.size > 0) {
      await refreshLiveScorecards(
        tournamentId,
        meta.slashGolfTournId,
        meta.year,
        rows,
        selectedPoolIds,
      );
      return 'live-scorecards-refreshed';
    }
  }

  return 'leaderboard-refreshed';
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET() {
  const results: Record<string, string> = {};

  await Promise.allSettled(
    TOURNAMENT_IDS.map(async (id) => {
      try {
        results[id] = await refreshTournament(id);
      } catch (err) {
        results[id] = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }),
  );

  return Response.json({ refreshedAt: new Date().toISOString(), results });
}
