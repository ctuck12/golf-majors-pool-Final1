import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import {
  fetchLeaderboard,
  fetchScorecard,
  parseMongo,
  type SlashGolfLeaderboardRow,
  type SlashGolfLeaderboardResponse,
} from '@/app/lib/slashgolf';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import {
  getScorecardCache,
  saveScorecardCache,
  mergeScorecardCache,
  getRoundLeaderStore,
  saveRoundLeader,
  getRoundLeadersAwarded,
  getLowRoundStore,
  saveLowRound,
  getTournamentLowRoundScore,
  type StoredPlayerScorecards,
} from '@/app/lib/scorecard-store';
import {
  computeFullScoreBreakdown,
  buildPlaceholderScoreBreakdown,
} from '@/app/lib/scoring';
import {
  getSelectedPlayerIdsForTournament,
  TOURNAMENT_IDS,
  type TournamentId,
} from '@/app/lib/pool-store';

export const dynamic = 'force-dynamic';

// ── Leaderboard file cache ────────────────────────────────────────────────
// 2-minute TTL keeps calls to ~840/tournament (28 active hours × 30/hr)

const CACHE_TTL_MS = 120_000;
const DATA_ROOT = process.env.VERCEL ? '/tmp/golf-pool-data' : path.join(process.cwd(), 'data');
const CACHE_DIR = path.join(DATA_ROOT, 'leaderboard-cache');

type LeaderboardCacheFile = {
  cachedAt: string;
  leaderboard: SlashGolfLeaderboardRow[];
  currentRound: number;
  roundStatus: string;
  projectedCut: string | null;
};

async function readLeaderboardCache(tournamentId: string): Promise<LeaderboardCacheFile | null> {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${tournamentId}.json`), 'utf8');
    return JSON.parse(raw) as LeaderboardCacheFile;
  } catch {
    return null;
  }
}

async function writeLeaderboardCache(tournamentId: string, data: LeaderboardCacheFile) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    path.join(CACHE_DIR, `${tournamentId}.json`),
    JSON.stringify(data, null, 2),
    'utf8',
  );
}

// ── Name normalization ────────────────────────────────────────────────────

function normName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Slash Golf field parsing ──────────────────────────────────────────────
// Confirmed via live API — all numeric fields use MongoDB extended JSON format.

function normalizeScore(row: SlashGolfLeaderboardRow): string {
  const status = String(row.status ?? '').toLowerCase();
  if (status === 'cut' || status === 'mc') return 'CUT';
  if (status === 'wd') return 'WD';
  if (status === 'dq') return 'DQ';
  if (status === 'mdf') return 'MDF';

  // `total` is already a string like "-12", "+4", "E"
  const raw = String(row.total ?? '').trim();
  if (!raw || raw === '--') return '--';
  return raw;
}

function normalizeThru(row: SlashGolfLeaderboardRow): string {
  const raw = String(row.thru ?? '').trim();
  // Cut/WD players have thru="" — treat as "--"
  return raw || '--';
}

function normalizePosition(row: SlashGolfLeaderboardRow): string {
  return String(row.position ?? '--');
}

function normalizeTotalStrokes(row: SlashGolfLeaderboardRow): string {
  return String(row.totalStrokesFromCompletedRounds ?? '--');
}

// Get total strokes (not to-par) for a specific round from the rounds array
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
  const cut = lb.cutLines?.[0];
  return cut?.cutScore ?? null;
}

// ── Round completion handlers ─────────────────────────────────────────────

async function captureLowRound(
  tournamentId: string,
  roundId: number,
  rows: SlashGolfLeaderboardRow[],
) {
  const scores = rows
    .map((r) => getRoundStrokes(r, roundId))
    .filter((s): s is number => s !== null);
  if (!scores.length) return;
  await saveLowRound(tournamentId, roundId, Math.min(...scores));
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
  for (const row of rows) {
    rowByName.set(normName(`${row.firstName} ${row.lastName}`), row);
  }

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
    } catch {
      // Player not in field or scorecard unavailable — skip silently
    }
  }

  await saveScorecardCache(tournamentId, players, currentRound);
}

// ── Live scorecard refresh (selected players, in-round) ──────────────────
// Adaptive TTL keeps monthly API budget intact:
//   max(10 min, ceil(2.21 × N_selected) min)
// 8 selected ≈ 18 min between refreshes; 12 selected ≈ 27 min.

// 20k calls/month budget: 18,950 remaining after leaderboard (1,050)
// interval_min = N × (35hr × 60min) / 18,950 = N × 0.1108 → floor at 5 min
const LIVE_SCORECARD_MIN_TTL_MS = 5 * 60_000;

async function refreshLiveScorecards(
  tournamentId: string,
  meta: (typeof TOURNAMENT_META)[string],
  rows: SlashGolfLeaderboardRow[],
  selectedPoolIds: Set<number>,
): Promise<void> {
  const rowByName = new Map<string, SlashGolfLeaderboardRow>();
  for (const row of rows) {
    rowByName.set(normName(`${row.firstName} ${row.lastName}`), row);
  }

  const updatedPlayers: Record<string, StoredPlayerScorecards> = {};

  for (const poolPlayer of PLAYER_POOL_WITH_PGA_IDS) {
    if (!selectedPoolIds.has(poolPlayer.id)) continue;
    const row = rowByName.get(normName(poolPlayer.name));
    if (!row?.playerId) continue;
    const status = String(row.status ?? '').toLowerCase();
    if (status === 'cut' || status === 'wd' || status === 'dq') continue;
    // Only fetch players actively on the course — skip finished (F) and not-yet-started (--)
    const thru = normalizeThru(row);
    if (thru === 'F' || thru === '--') continue;

    try {
      const roundsRaw = await fetchScorecard(meta.slashGolfTournId, meta.year, row.playerId);
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
    } catch {
      // Player not in field or scorecard unavailable — skip silently
    }
  }

  if (Object.keys(updatedPlayers).length > 0) {
    await mergeScorecardCache(tournamentId, updatedPlayers);
  }
}

// ── Odds (preserved from original) ───────────────────────────────────────

const TOURNAMENT_ODDS_LOCK_AT: Record<string, string> = {
  players: '2026-03-09T08:00:00-05:00',
  masters: '2026-04-06T08:00:00-05:00',
  pga: '2026-05-11T08:00:00-05:00',
  'us-open': '2026-06-15T08:00:00-05:00',
  open: '2026-07-13T08:00:00-05:00',
};

const TOURNAMENT_ODDS_PAGES: Record<string, string> = {
  players: 'https://www.oddschecker.com/us/golf/the-players-championship/winner',
  masters: 'https://www.oddschecker.com/us/golf/the-masters/winner',
  pga: 'https://www.oddschecker.com/us/golf/pga-championship/winner',
  'us-open': 'https://www.oddschecker.com/us/golf/us-open/winner',
  open: 'https://www.oddschecker.com/us/golf/the-open-championship/winner',
};

const LOCKED_ODDS_DIR = DATA_ROOT;
const LOCKED_ODDS_FILE = path.join(LOCKED_ODDS_DIR, 'locked-odds.json');

type OddsRow = { canonicalName: string; odds: string };
type LockedOddsSnapshot = { fetchedAt: string; lockedAt: string; players: OddsRow[] };

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlToLines(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const blockBreaks = withoutScripts.replace(
    /<\/(tr|table|thead|tbody|p|div|li|ul|ol|section|article|header|footer|h1|h2|h3|h4|h5|br)>/gi,
    '\n',
  );
  return decodeHtml(blockBreaks)
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractWinnerSection(lines: string[]) {
  const winnerIndex = lines.findIndex((line) => line === 'Winner');
  if (winnerIndex < 0) return lines;
  const endIndex = lines.findIndex(
    (line, index) =>
      index > winnerIndex &&
      (line === 'Top 10 Finish' ||
        line === 'Top 5 Finish' ||
        line === 'Top 20 Finish' ||
        line === '1st Round Leader' ||
        line === 'Compare All Odds' ||
        line === 'Picks' ||
        line === 'More Insights'),
  );
  return lines.slice(winnerIndex, endIndex > winnerIndex ? endIndex : undefined);
}

function extractOddsFromSection(lines: string[], watchedPlayers: string[]): OddsRow[] {
  const americanOddsPattern = /^[+-]\d{2,5}$/;
  const section = extractWinnerSection(lines);
  const players: OddsRow[] = [];
  for (const watchedPlayer of watchedPlayers) {
    const normalized = normName(watchedPlayer);
    const playerIndex = section.findIndex((line) => normName(line) === normalized);
    if (playerIndex < 0) continue;
    let foundOdds: string | null = null;
    for (let i = playerIndex + 1; i <= Math.min(playerIndex + 4, section.length - 1); i++) {
      if (americanOddsPattern.test(section[i])) {
        foundOdds = section[i];
        break;
      }
    }
    if (!foundOdds) continue;
    players.push({ canonicalName: watchedPlayer, odds: foundOdds });
  }
  return players;
}

async function readLockedOddsStore(): Promise<Record<string, LockedOddsSnapshot>> {
  try {
    return JSON.parse(await readFile(LOCKED_ODDS_FILE, 'utf8')) as Record<
      string,
      LockedOddsSnapshot
    >;
  } catch {
    return {};
  }
}

async function saveLockedOddsSnapshot(tournamentId: string, snapshot: LockedOddsSnapshot) {
  await mkdir(LOCKED_ODDS_DIR, { recursive: true });
  const store = await readLockedOddsStore();
  store[tournamentId] = snapshot;
  await writeFile(LOCKED_ODDS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

async function getOdds(
  tournamentId: string,
  watchedPlayers: string[],
): Promise<{ source: string; players: OddsRow[] }> {
  const oddsLockAt = TOURNAMENT_ODDS_LOCK_AT[tournamentId];
  const shouldLock = oddsLockAt ? Date.now() >= new Date(oddsLockAt).getTime() : false;

  if (shouldLock) {
    const store = await readLockedOddsStore();
    const snap = store[tournamentId];
    if (snap) return { source: `Locked Monday odds (${snap.lockedAt})`, players: snap.players };
  }

  const oddsPageUrl = TOURNAMENT_ODDS_PAGES[tournamentId];
  let live: { source: string; players: OddsRow[] } = {
    source: 'no odds page configured',
    players: [],
  };

  if (oddsPageUrl) {
    try {
      const res = await fetch(oddsPageUrl, {
        cache: 'no-store',
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      if (res.ok) {
        const ps = extractOddsFromSection(htmlToLines(await res.text()), watchedPlayers);
        live = { source: ps.length ? 'Oddschecker scrape' : 'odds fallback (no matches)', players: ps };
      } else {
        live = { source: `odds fallback (${res.status})`, players: [] };
      }
    } catch {
      live = { source: 'odds fallback (fetch error)', players: [] };
    }
  }

  if (shouldLock && live.players.length) {
    await saveLockedOddsSnapshot(tournamentId, {
      fetchedAt: new Date().toISOString(),
      lockedAt: oddsLockAt,
      players: live.players,
    });
    return { source: `Locked Monday odds (${oddsLockAt})`, players: live.players };
  }

  return live;
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'pga';
  const meta = TOURNAMENT_META[tournamentId];

  if (!meta) {
    return Response.json({ error: 'Unknown tournament id.' }, { status: 400 });
  }

  // ── 1. Leaderboard with 2-minute file cache ────────────────────────────
  let rows: SlashGolfLeaderboardRow[];
  let currentRound: number;
  let roundStatus: string;
  let projectedCut: string | null;
  let source: string;

  const cached = await readLeaderboardCache(tournamentId);
  if (cached && Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) {
    rows = cached.leaderboard;
    currentRound = cached.currentRound;
    roundStatus = cached.roundStatus;
    projectedCut = cached.projectedCut;
    source = 'slash-golf-cache';
  } else {
    try {
      const lb = await fetchLeaderboard(meta.slashGolfTournId, meta.year);
      rows = lb.leaderboardRows ?? [];
      currentRound = parseMongo(lb.roundId);  // top-level roundId = current round
      roundStatus = lb.roundStatus ?? lb.status ?? '';
      projectedCut = extractProjectedCut(lb);
      source = 'slash-golf-live';
      await writeLeaderboardCache(tournamentId, {
        cachedAt: new Date().toISOString(),
        leaderboard: rows,
        currentRound,
        roundStatus,
        projectedCut,
      });
    } catch (err) {
      return Response.json(
        { error: `Slash Golf API error: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }
  }

  // ── 2. Detect round completion → refresh scorecard & leader data ───────
  let scorecardCache = await getScorecardCache(tournamentId);
  let roundLeaderStore = await getRoundLeaderStore();
  let lowRoundStore = await getLowRoundStore();

  const roundComplete = isRoundComplete(roundStatus);
  const needsRefresh = roundComplete && (scorecardCache?.lastCompletedRound ?? 0) < currentRound;

  if (needsRefresh) {
    await captureLowRound(tournamentId, currentRound, rows);
    if (currentRound <= 3) {
      await captureRoundLeader(tournamentId, currentRound, rows);
    }
    await refreshScorecards(
      tournamentId,
      meta.slashGolfTournId,
      meta.year,
      rows,
      currentRound,
    );
    // Reload after refresh
    scorecardCache = await getScorecardCache(tournamentId);
    roundLeaderStore = await getRoundLeaderStore();
    lowRoundStore = await getLowRoundStore();
  }

  // ── 2b. Live scorecard refresh for selected players (during active round) ─
  if (!roundComplete && TOURNAMENT_IDS.includes(tournamentId as TournamentId)) {
    const selectedPoolIds = await getSelectedPlayerIdsForTournament(tournamentId as TournamentId);
    const nSelected = selectedPoolIds.size;
    if (nSelected > 0) {
      const adaptiveTtlMs = Math.max(
        LIVE_SCORECARD_MIN_TTL_MS,
        Math.ceil(0.1108 * nSelected) * 60_000,
      );
      const lastLive = scorecardCache?.liveRefreshedAt;
      const liveStale =
        !lastLive || Date.now() - new Date(lastLive).getTime() > adaptiveTtlMs;
      if (liveStale) {
        await refreshLiveScorecards(tournamentId, meta, rows, selectedPoolIds);
        scorecardCache = await getScorecardCache(tournamentId);
      }
    }
  }

  const tournamentLowRound = getTournamentLowRoundScore(tournamentId, lowRoundStore);

  // ── 3. Build scored player list ────────────────────────────────────────
  const poolByName = new Map(PLAYER_POOL_WITH_PGA_IDS.map((p) => [normName(p.name), p]));
  const watchedPlayerNames = PLAYER_POOL_WITH_PGA_IDS.map((p) => p.name);

  const players = rows
    .map((row) => {
      const fullName = `${row.firstName} ${row.lastName}`;
      const poolPlayer = poolByName.get(normName(fullName));
      if (!poolPlayer) return null;

      const score = normalizeScore(row);
      const position = normalizePosition(row);
      const thru = normalizeThru(row);
      const total = normalizeTotalStrokes(row);

      const storedScorecard = scorecardCache?.players[row.playerId];
      const rounds = storedScorecard?.rounds ?? [];

      const roundLeadersAwarded = getRoundLeadersAwarded(
        tournamentId,
        fullName,
        roundLeaderStore,
      );

      const scoreBreakdown =
        rounds.length > 0
          ? computeFullScoreBreakdown({
              position,
              score,
              thru,
              rounds,
              roundLeadersAwarded,
              tournamentLowRoundScore: tournamentLowRound,
            })
          : buildPlaceholderScoreBreakdown({ position, score, thru });

      return { position, score, thru, total, canonicalName: poolPlayer.name, scoreBreakdown };
    })
    .filter(Boolean);

  // ── 4. Odds ────────────────────────────────────────────────────────────
  const odds = await getOdds(tournamentId, watchedPlayerNames);

  return Response.json({
    source,
    oddsSource: odds.source,
    tournamentId,
    status: roundStatus || 'Status unavailable',
    projectedCut,
    fetchedAt: new Date().toISOString(),
    players,
    odds: odds.players,
  });
}
