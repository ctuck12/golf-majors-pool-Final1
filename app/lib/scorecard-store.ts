import redis from './redis';
import type { SlashGolfLeaderboardRow } from './slashgolf';

// ── Name normalization ─────────────────────────────────────────────────────

export function normName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Types ──────────────────────────────────────────────────────────────────

export type StoredHole = { holeNumber: number; par: number; score: number };
export type StoredRound = { roundId: number; holes: StoredHole[] };

export type StoredPlayerScorecards = {
  playerId: string;
  playerName: string;
  rounds: StoredRound[];
  refreshedAt: string;
};

export type ScorecardCacheFile = {
  tournamentId: string;
  lastCompletedRound: number;
  players: Record<string, StoredPlayerScorecards>;
  refreshedAt: string;
  liveRefreshedAt: string | null;
};

export type RoundLeaderEntry = {
  leaders: string[];
  leadScore: number;
  capturedAt: string;
};

export type RoundLeaderStore = Record<
  string,
  Record<string, RoundLeaderEntry | null>
>;

export type TournamentLowRoundStore = Record<
  string,
  Record<string, number | null>
>;

export type LeaderboardCacheFile = {
  cachedAt: string;
  leaderboard: SlashGolfLeaderboardRow[];
  currentRound: number;
  roundStatus: string;
  projectedCut: string | null;
  notStarted?: boolean;
};

// ── Redis helpers ──────────────────────────────────────────────────────────

async function rget<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function rset(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const json = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, json);
  } else {
    await redis.set(key, json);
  }
}

// ── Scorecard cache ────────────────────────────────────────────────────────

function scorecardKey(tournamentId: string) {
  return `scorecard-cache:${tournamentId}`;
}

export async function getScorecardCache(tournamentId: string): Promise<ScorecardCacheFile | null> {
  return rget<ScorecardCacheFile>(scorecardKey(tournamentId));
}

export async function saveScorecardCache(
  tournamentId: string,
  players: Record<string, StoredPlayerScorecards>,
  lastCompletedRound: number,
): Promise<void> {
  await rset(scorecardKey(tournamentId), {
    tournamentId,
    lastCompletedRound,
    players,
    refreshedAt: new Date().toISOString(),
    liveRefreshedAt: null,
  } satisfies ScorecardCacheFile);
}

export async function mergeScorecardCache(
  tournamentId: string,
  updatedPlayers: Record<string, StoredPlayerScorecards>,
): Promise<void> {
  const existing = await getScorecardCache(tournamentId);
  await rset(scorecardKey(tournamentId), {
    tournamentId,
    lastCompletedRound: existing?.lastCompletedRound ?? 0,
    players: { ...(existing?.players ?? {}), ...updatedPlayers },
    refreshedAt: existing?.refreshedAt ?? new Date().toISOString(),
    liveRefreshedAt: new Date().toISOString(),
  } satisfies ScorecardCacheFile);
}

// ── Round leaders ──────────────────────────────────────────────────────────

const ROUND_LEADERS_KEY = 'round-leaders';

export async function getRoundLeaderStore(): Promise<RoundLeaderStore> {
  return (await rget<RoundLeaderStore>(ROUND_LEADERS_KEY)) ?? {};
}

export async function saveRoundLeader(
  tournamentId: string,
  roundId: number,
  leaders: string[],
  leadScore: number,
): Promise<void> {
  const store = await getRoundLeaderStore();
  store[tournamentId] ??= {};
  store[tournamentId][String(roundId)] = {
    leaders,
    leadScore,
    capturedAt: new Date().toISOString(),
  };
  await rset(ROUND_LEADERS_KEY, store);
}

export function getRoundLeadersAwarded(
  tournamentId: string,
  playerName: string,
  store: RoundLeaderStore,
): { first: boolean; second: boolean; third: boolean } {
  const rounds = store[tournamentId] ?? {};
  const norm = (s: string) => s.toLowerCase().trim();
  const isLeader = (roundKey: string) =>
    rounds[roundKey]?.leaders.some((n) => norm(n) === norm(playerName)) ?? false;
  return { first: isLeader('1'), second: isLeader('2'), third: isLeader('3') };
}

// ── Tournament low round ───────────────────────────────────────────────────

const LOW_ROUNDS_KEY = 'low-rounds';

export async function getLowRoundStore(): Promise<TournamentLowRoundStore> {
  return (await rget<TournamentLowRoundStore>(LOW_ROUNDS_KEY)) ?? {};
}

export async function saveLowRound(
  tournamentId: string,
  roundId: number,
  lowScore: number,
): Promise<void> {
  const store = await getLowRoundStore();
  store[tournamentId] ??= {};
  store[tournamentId][String(roundId)] = lowScore;
  await rset(LOW_ROUNDS_KEY, store);
}

export function getTournamentLowRoundScore(
  tournamentId: string,
  store: TournamentLowRoundStore,
): number | null {
  const rounds = store[tournamentId] ?? {};
  const scores = Object.values(rounds).filter((s): s is number => s !== null);
  return scores.length ? Math.min(...scores) : null;
}

// ── Leaderboard cache ──────────────────────────────────────────────────────

// not-started entries get a 30-minute TTL so the cron backs off automatically
const NOT_STARTED_TTL_SECONDS = 30 * 60;

function leaderboardKey(tournamentId: string) {
  return `leaderboard-cache:${tournamentId}`;
}

export async function readLeaderboardCache(tournamentId: string): Promise<LeaderboardCacheFile | null> {
  return rget<LeaderboardCacheFile>(leaderboardKey(tournamentId));
}

export async function writeLeaderboardCache(
  tournamentId: string,
  data: LeaderboardCacheFile,
): Promise<void> {
  // not-started entries expire on their own so the cron retries after 30 min
  const ttl = data.notStarted ? NOT_STARTED_TTL_SECONDS : undefined;
  await rset(leaderboardKey(tournamentId), data, ttl);
}
