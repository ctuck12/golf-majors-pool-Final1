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

  // First successful fetch after notStarted — auto-lock picks so nobody sneaks in a late change
  if (wasNotStarted && TOURNAMENT_IDS.includes(tournamentId as TournamentId)) {
    await autoLockPoolLineup(tournamentId as TournamentId);
  }

  const { leaderboardRows: rows, currentRound, roundStatus, projectedCut, playerScorecards } = espnResult;

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

  const roundComplete = isRoundComplete(roundStatus);
  const needsFullRefresh = roundComplete && (scorecardCache?.lastCompletedRound ?? 0) < currentRound;

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

  if (roundComplete && currentRound >= 4 && (scorecardCache?.lastCompletedRound ?? 0) >= currentRound) {
    await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
    return 'tournament-complete-marked';
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
