// Internal leaderboard row shape + Mongo-extended-JSON number helper.
//
// HISTORY: these types originated with the (paid) Slash Golf / RapidAPI feed, which the app
// no longer calls anywhere — live scoring is 100% ESPN (see app/lib/espn.ts, whose
// fetchESPNTournament normalizes ESPN's event feed into this same row shape). The type names
// keep their original "SlashGolf" prefix only to avoid churn across the codebase; there is no
// API key, no fetch, and no billable call in this module.

// ── MongoDB extended JSON helper ───────────────────────────────────────────
// Legacy cached rows may wrap numbers as {"$numberInt":"4"} or {"$numberLong":"..."}

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

// ── Leaderboard row shape (produced by the ESPN normalizer, stored in Redis) ──

export type SlashGolfLeaderboardRound = {
  roundId: unknown;           // {"$numberInt":"1"} or plain number — use parseMongo()
  scoreToPar: string;         // "-5", "+1", "E"
  strokes: unknown;           // {"$numberInt":"67"} or plain number — use parseMongo()
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
  currentRound: unknown;                   // use parseMongo()
  totalStrokesFromCompletedRounds: string; // "276"
  rounds: SlashGolfLeaderboardRound[];
  roundComplete: boolean;
  [key: string]: unknown;
};
