import redis from './redis';
import { PLAYER_POOL_WITH_PGA_IDS } from './player-pool';

// Commissioner-editable salary pick list.
//
// Pick-sheet salaries are normally computed from odds, with a hand-tuned override map per field. That
// map used to be hardcoded (PGA_SALARY_OVERRIDES in page.tsx), so updating it meant a code change +
// deploy. This store lets the commissioner PASTE a "name  salary" list and have it apply instantly:
// names are resolved to pool player IDs here, the id->salary map is stored in Redis, and the pick sheet
// reads it via /api/salary-overrides. When nothing is stored, the built-in map is used (unchanged).

const STORE_KEY = 'salary-overrides:v1';

export type ManualSalaries = {
  map: Record<number, number>; // pool player id -> salary
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
for (const p of PLAYER_POOL_WITH_PGA_IDS) {
  const n = norm(p.name);
  if (!BY_NORM.has(n)) BY_NORM.set(n, p.id);
  const fl = firstLast(p.name);
  if (!BY_FL.has(fl)) BY_FL.set(fl, p.id);
}
function resolveId(name: string): number | null {
  return BY_NORM.get(norm(name)) ?? BY_FL.get(firstLast(name)) ?? null;
}

export type SalaryParseResult = {
  map: Record<number, number>;
  matched: { id: number; name: string; salary: number }[];
  unmatched: { name: string; salary: number }[]; // names not found in the pool (commissioner reviews)
  skipped: string[];                              // lines with no readable salary
};

// Parse a pasted "Name  Salary" block. Salary is the trailing number on each line ($ and commas ok);
// an optional leading rank/order number is ignored. e.g. "Scottie Scheffler  $11,900" or
// "1  Rory McIlroy  10200".
export function parseSalaryPaste(text: string): SalaryParseResult {
  const map: Record<number, number> = {};
  const matched: { id: number; name: string; salary: number }[] = [];
  const unmatched: { name: string; salary: number }[] = [];
  const skipped: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const tokens = line.split(/[\s\t]+/);
    const salaryTok = tokens[tokens.length - 1];
    const salary = parseInt(salaryTok.replace(/[$,]/g, ''), 10);
    if (isNaN(salary) || salary <= 0) { skipped.push(line); continue; }
    let nameTokens = tokens.slice(0, -1);
    // Drop a leading rank/order column if present (purely numeric first token).
    if (nameTokens.length > 1 && /^[\d.]+$/.test(nameTokens[0])) nameTokens = nameTokens.slice(1);
    const name = nameTokens.join(' ').replace(/[,]/g, '').trim();
    if (!name) { skipped.push(line); continue; }
    const id = resolveId(name);
    if (id == null) { unmatched.push({ name, salary }); continue; }
    if (!(id in map)) { map[id] = salary; matched.push({ id, name, salary }); }
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

export async function saveManualSalaries(map: Record<number, number>, updatedAt: string): Promise<ManualSalaries> {
  const payload: ManualSalaries = { map, updatedAt, count: Object.keys(map).length };
  await redis.set(STORE_KEY, JSON.stringify(payload));
  return payload;
}

export async function clearManualSalaries(): Promise<void> {
  await redis.del(STORE_KEY);
}
