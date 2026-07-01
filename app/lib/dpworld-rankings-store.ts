import redis from './redis';

// Commissioner-editable DP World Tour "Race to Dubai" rankings.
//
// The bubble's primary source is a hand-maintained list. Editing it used to mean changing code and
// redeploying before every major. This store lets the commissioner PASTE the current standings into a
// page and have them apply instantly — no code, no deploy. The pasted list is stored in Redis and read
// first by /api/player-dpworld-rank, which falls back to the built-in snapshot for anyone not listed.

const STORE_KEY = 'dpworld-rankings:manual:v1';

export type ManualDpwRankings = {
  map: Record<string, number>; // raw player name -> rank (normalized at read time by the consumer)
  updatedAt: string;           // ISO timestamp of last save
  count: number;               // number of players parsed
};

export type DpwParseResult = {
  map: Record<string, number>;
  count: number;
  skipped: string[]; // lines we couldn't parse (shown back to the commissioner for review)
};

// Parse a pasted standings block. Expected shape per line: a leading rank number then the player name,
// e.g. "1 Patrick Reed", "1. Rory McIlroy", or "1  Rory McIlroy  2,690.52" (trailing points ignored).
// Tolerant of tabs, a leading "T"/"=" tie marker, a trailing "(RSA)"-style country, and points columns.
export function parseDpWorldPaste(text: string): DpwParseResult {
  const map: Record<string, number> = {};
  const skipped: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Leading rank (optionally tie-marked / punctuated), then the remainder.
    const m = line.match(/^[T=]?\s*(\d{1,3})[.):]?\s+(.+)$/);
    if (!m) { skipped.push(line); continue; }
    const rank = parseInt(m[1], 10);
    const rest = m[2].trim().replace(/\([^)]*\)\s*$/, '').trim(); // strip trailing "(RSA)" country
    const isNum = (t: string) => /^[+\-]?[\d.,]+%?$/.test(t);
    let name: string;
    const comma = rest.indexOf(',');
    if (comma > 0) {
      // "LASTNAME, Firstname [points]" (e.g. "REED, Patrick") -> "Firstname Lastname" so it matches
      // pool player names. Everything before the comma is the (possibly multi-word) last name.
      const last = rest.slice(0, comma).trim();
      const firstTokens: string[] = [];
      for (const t of rest.slice(comma + 1).trim().split(/[\s\t]+/)) {
        if (isNum(t)) break; // trailing points column reached
        firstTokens.push(t);
      }
      name = `${firstTokens.join(' ')} ${last}`.trim();
    } else {
      // "Rank Firstname Lastname [points]" — name is the leading run of non-numeric tokens.
      const nameTokens: string[] = [];
      for (const t of rest.split(/[\s\t]+/)) {
        if (isNum(t)) break;
        nameTokens.push(t);
      }
      name = nameTokens.join(' ').trim();
    }
    if (name && rank > 0) {
      if (!(name in map)) map[name] = rank; // first occurrence wins
    } else {
      skipped.push(line);
    }
  }
  return { map, count: Object.keys(map).length, skipped };
}

export async function getManualDpWorldRankings(): Promise<ManualDpwRankings | null> {
  try {
    const raw = await redis.get(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw as string) as ManualDpwRankings;
    return parsed && parsed.map && Object.keys(parsed.map).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveManualDpWorldRankings(map: Record<string, number>, updatedAt: string): Promise<ManualDpwRankings> {
  const payload: ManualDpwRankings = { map, updatedAt, count: Object.keys(map).length };
  await redis.set(STORE_KEY, JSON.stringify(payload));
  return payload;
}

export async function clearManualDpWorldRankings(): Promise<void> {
  await redis.del(STORE_KEY);
}
