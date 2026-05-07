const BASE_URL = 'https://live-golf-data.p.rapidapi.com';

function headers() {
  const key = process.env.SLASH_GOLF_API_KEY;
  if (!key) throw new Error('SLASH_GOLF_API_KEY is not set');
  return {
    'x-rapidapi-host': 'live-golf-data.p.rapidapi.com',
    'x-rapidapi-key': key,
  };
}

// ── MongoDB extended JSON helper ───────────────────────────────────────────
// The API returns numbers wrapped as {"$numberInt":"4"} or {"$numberLong":"..."}

export function parseMongo(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val);
  if (val !== null && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const n = obj['$numberInt'] ?? obj['$numberLong'] ?? obj['$numberDouble'];
    if (n !== undefined) return Number(n);
  }
  return 0;
}

// ── Response types (field names confirmed via live API calls) ──────────────

export type SlashGolfLeaderboardRound = {
  roundId: unknown;           // {"$numberInt":"1"} — use parseMongo()
  scoreToPar: string;         // "-5", "+1", "E"
  strokes: unknown;           // {"$numberInt":"67"} — use parseMongo()
  courseName?: string;
};

export type SlashGolfLeaderboardRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;                        // "1", "T5", "CUT", "WD"
  total: string;                           // "-12", "+4", "E" (total to par)
  thru: string;                            // "F", "9", "" (empty when not playing)
  status: string;                          // "complete" | "cut" | "wd" | "dq"
  currentRound: unknown;                   // {"$numberInt":"4"} — use parseMongo()
  totalStrokesFromCompletedRounds: string; // "276"
  rounds: SlashGolfLeaderboardRound[];
  roundComplete: boolean;
  [key: string]: unknown;
};

export type SlashGolfLeaderboardResponse = {
  tournId: string;
  year: string;
  roundId: unknown;           // {"$numberInt":"4"} — use parseMongo() for current round
  roundStatus: string;        // "Official" | "In Progress" | "Complete"
  status: string;             // mirrors roundStatus
  leaderboardRows: SlashGolfLeaderboardRow[];
  cutLines?: Array<{ cutCount: unknown; cutScore: string }>;
  [key: string]: unknown;
};

// Scorecard response is an array — one element per round
export type SlashGolfScorecardHole = {
  holeId: unknown;    // {"$numberInt":"1"} — use parseMongo()
  holeScore: unknown; // {"$numberInt":"4"} — use parseMongo()
  par: unknown;       // {"$numberInt":"4"} — use parseMongo()
};

export type SlashGolfScorecardRound = {
  roundId: unknown;       // {"$numberInt":"1"} — use parseMongo()
  roundComplete: boolean;
  currentRoundScore: string; // "-5", "+1"
  holes: Record<string, SlashGolfScorecardHole>; // keyed by hole number string "1".."18"
  [key: string]: unknown;
};

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchLeaderboard(
  tournId: string,
  year: string,
  roundId?: number,
): Promise<SlashGolfLeaderboardResponse> {
  const params = new URLSearchParams({ tournId, year });
  if (roundId !== undefined) params.set('roundId', String(roundId));
  const res = await fetch(`${BASE_URL}/leaderboard?${params}`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Slash Golf leaderboard ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchScorecard(
  tournId: string,
  year: string,
  playerId: string,
  roundId?: number,
): Promise<SlashGolfScorecardRound[]> {
  const params = new URLSearchParams({ tournId, year, playerId });
  if (roundId !== undefined) params.set('roundId', String(roundId));
  // Endpoint is /scorecard (singular) — confirmed via live API
  const res = await fetch(`${BASE_URL}/scorecard?${params}`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Slash Golf scorecard ${res.status}: ${await res.text()}`);
  return res.json(); // returns array of round objects
}

export async function fetchSchedule(year: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/schedule?year=${year}`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Slash Golf schedule ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchTournament(tournId: string, year: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/tournament?tournId=${tournId}&year=${year}`, {
    cache: 'no-store',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Slash Golf tournament ${res.status}: ${await res.text()}`);
  return res.json();
}
