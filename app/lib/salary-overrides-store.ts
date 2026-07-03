import redis from './redis';
import { PLAYER_POOL_WITH_PGA_IDS } from './player-pool';
import { canonicalNameKey } from './name-match';

// Commissioner-editable salary + world-rank pick list.
//
// Pick-sheet salaries are normally computed from odds (with a hand-tuned override map) and world ranks
// come from the static pool list. Updating either used to mean a code change + deploy. This store lets
// the commissioner PASTE or UPLOAD a "Rank  Name  Salary" list and have it apply instantly: names are
// resolved to pool player IDs here, the id -> {salary, worldRank} map is stored in Redis, and the pick
// sheet reads it via /api/salary-overrides. When nothing is stored, the built-in values are used.

const STORE_KEY = 'salary-overrides:v2'; // v2: now also carries world rank

export type OverrideEntry = { salary: number; worldRank: number | null };

export type ManualSalaries = {
  map: Record<number, OverrideEntry>; // pool player id -> { salary, worldRank }
  updatedAt: string;
  count: number;
};

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o').replace(/æ/gi, 'ae').replace(/ß/gi, 'ss')
    .toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}
const firstLast = (s: string) => {
  const p = norm(s).split(' ').filter(Boolean);
  return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : norm(s);
};

// Build normalized-name -> pool id lookups once (module scope).
const BY_NORM = new Map<string, number>();
const BY_FL = new Map<string, number>();
const BY_CANON = new Map<string, number>(); // order-independent (Last,First or First Last both match)
for (const p of PLAYER_POOL_WITH_PGA_IDS) {
  const n = norm(p.name);
  if (!BY_NORM.has(n)) BY_NORM.set(n, p.id);
  const fl = firstLast(p.name);
  if (!BY_FL.has(fl)) BY_FL.set(fl, p.id);
  const ck = canonicalNameKey(p.name);
  if (!BY_CANON.has(ck)) BY_CANON.set(ck, p.id);
}
function resolveId(name: string): number | null {
  return BY_NORM.get(norm(name)) ?? BY_FL.get(firstLast(name)) ?? BY_CANON.get(canonicalNameKey(name)) ?? null;
}

export type SalaryParseResult = {
  map: Record<number, OverrideEntry>;
  matched: { id: number; name: string; salary: number; worldRank: number | null }[];
  unmatched: { name: string; salary: number; worldRank: number | null }[]; // names not in the pool
  skipped: string[];                              // lines with no readable salary (incl. any header row)
};

// Parse a pasted/uploaded block. Each line: an optional leading World-Rank number, the player name, and
// a trailing Salary number ("$"/commas ok). e.g. "1  Scottie Scheffler  11900" or "Rory McIlroy 10200".
// A header row like "World Golf Rank  Player Name  Salary" has no trailing number, so it's skipped.
// `extra` lets already-auto-added dynamic players (see dynamic-pool-store.ts) also match, so re-uploads
// reuse their existing ID instead of reporting them as unmatched again.
export function parseSalaryPaste(text: string, extra?: Array<{ id: number; name: string }>): SalaryParseResult {
  const map: Record<number, OverrideEntry> = {};
  const matched: { id: number; name: string; salary: number; worldRank: number | null }[] = [];
  const unmatched: { name: string; salary: number; worldRank: number | null }[] = [];
  const skipped: string[] = [];
  const extraByNorm = new Map<string, number>();
  const extraByFL = new Map<string, number>();
  const extraByCanon = new Map<string, number>();
  for (const p of extra ?? []) {
    const n = norm(p.name);
    if (!extraByNorm.has(n)) extraByNorm.set(n, p.id);
    const fl = firstLast(p.name);
    if (!extraByFL.has(fl)) extraByFL.set(fl, p.id);
    const ck = canonicalNameKey(p.name);
    if (!extraByCanon.has(ck)) extraByCanon.set(ck, p.id);
  }
  const resolveWithExtra = (name: string): number | null =>
    resolveId(name) ?? extraByNorm.get(norm(name)) ?? extraByFL.get(firstLast(name)) ?? extraByCanon.get(canonicalNameKey(name)) ?? null;
  const isNum = (t: string) => /^[$]?[+\-]?[\d,]+(?:\.\d+)?$/.test(t);

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const tokens = line.split(/[\s\t]+/);
    const salaryTok = tokens[tokens.length - 1];
    const salary = parseInt(salaryTok.replace(/[$,]/g, ''), 10);
    if (!isNum(salaryTok) || isNaN(salary) || salary <= 0) { skipped.push(line); continue; }

    let nameTokens = tokens.slice(0, -1);
    let worldRank: number | null = null;
    // A leading numeric token is the World Golf Rank column.
    if (nameTokens.length > 1 && isNum(nameTokens[0])) {
      const r = parseInt(nameTokens[0].replace(/[,]/g, ''), 10);
      if (!isNaN(r) && r > 0) worldRank = r;
      nameTokens = nameTokens.slice(1);
    }
    const name = nameTokens.join(' ').replace(/,/g, '').trim();
    if (!name) { skipped.push(line); continue; }

    const id = resolveWithExtra(name);
    if (id == null) { unmatched.push({ name, salary, worldRank }); continue; }
    if (!(id in map)) { map[id] = { salary, worldRank }; matched.push({ id, name, salary, worldRank }); }
  }
  return { map, matched, unmatched, skipped };
}

export async function getManualSalaries(): Promise<ManualSalaries | null> {
  try {
    const raw = await redis.get(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw as string) as ManualSalaries;
    return parsed && parsed.map && Object.keys(parsed.map).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveManualSalaries(map: Record<number, OverrideEntry>, updatedAt: string): Promise<ManualSalaries> {
  const payload: ManualSalaries = { map, updatedAt, count: Object.keys(map).length };
  await redis.set(STORE_KEY, JSON.stringify(payload));
  return payload;
}

export async function clearManualSalaries(): Promise<void> {
  await redis.del(STORE_KEY);
}
