import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Vercel's serverless root is read-only; /tmp is the only writable dir at runtime.
const DATA_DIR = process.env.VERCEL ? '/tmp/golf-pool-data' : path.join(process.cwd(), 'data');

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
  players: Record<string, StoredPlayerScorecards>; // keyed by playerId
  refreshedAt: string;
  liveRefreshedAt: string | null;
};

export type RoundLeaderEntry = {
  leaders: string[];   // canonical player names
  leadScore: number;   // total to par at the time (e.g. -8)
  capturedAt: string;
};

export type RoundLeaderStore = Record<
  string, // tournamentId
  Record<string, RoundLeaderEntry | null> // roundId string → entry
>;

export type TournamentLowRoundStore = Record<
  string, // tournamentId
  Record<string, number | null> // roundId string → lowest round total (strokes)
>;

// ── Helpers ────────────────────────────────────────────────────────────────

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── Scorecard cache ────────────────────────────────────────────────────────

function scorecardPath(tournamentId: string) {
  return path.join(DATA_DIR, 'scorecard-cache', `${tournamentId}.json`);
}

export async function getScorecardCache(tournamentId: string): Promise<ScorecardCacheFile | null> {
  return readJson<ScorecardCacheFile>(scorecardPath(tournamentId));
}

export async function saveScorecardCache(
  tournamentId: string,
  players: Record<string, StoredPlayerScorecards>,
  lastCompletedRound: number,
): Promise<void> {
  await writeJson(scorecardPath(tournamentId), {
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
  await writeJson(scorecardPath(tournamentId), {
    tournamentId,
    lastCompletedRound: existing?.lastCompletedRound ?? 0,
    players: { ...(existing?.players ?? {}), ...updatedPlayers },
    refreshedAt: existing?.refreshedAt ?? new Date().toISOString(),
    liveRefreshedAt: new Date().toISOString(),
  } satisfies ScorecardCacheFile);
}

// ── Round leaders ──────────────────────────────────────────────────────────

const ROUND_LEADERS_PATH = path.join(DATA_DIR, 'round-leaders.json');

export async function getRoundLeaderStore(): Promise<RoundLeaderStore> {
  return (await readJson<RoundLeaderStore>(ROUND_LEADERS_PATH)) ?? {};
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
  await writeJson(ROUND_LEADERS_PATH, store);
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

const LOW_ROUNDS_PATH = path.join(DATA_DIR, 'tournament-low-rounds.json');

export async function getLowRoundStore(): Promise<TournamentLowRoundStore> {
  return (await readJson<TournamentLowRoundStore>(LOW_ROUNDS_PATH)) ?? {};
}

export async function saveLowRound(
  tournamentId: string,
  roundId: number,
  lowScore: number,
): Promise<void> {
  const store = await getLowRoundStore();
  store[tournamentId] ??= {};
  store[tournamentId][String(roundId)] = lowScore;
  await writeJson(LOW_ROUNDS_PATH, store);
}

export function getTournamentLowRoundScore(
  tournamentId: string,
  store: TournamentLowRoundStore,
): number | null {
  const rounds = store[tournamentId] ?? {};
  const scores = Object.values(rounds).filter((s): s is number => s !== null);
  return scores.length ? Math.min(...scores) : null;
}
