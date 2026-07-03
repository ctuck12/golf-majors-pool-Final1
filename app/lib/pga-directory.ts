import redis from './redis';

// Resolves a PGA Tour player id from a name using the PGA Tour player directory (tourCode R).
// The full directory is fetched once and cached in Redis for 6 hours, then matched by normalized name.
// Used to auto-fill pgaTourId for players the commissioner's field/salary uploads add to the pool, so
// their PGA-specific stats (cuts, major starts/cuts/wins) load without any manual step.

const GQL_URL = 'https://orchestrator.pgatour.com/graphql';
const GQL_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const CACHE_KEY = 'pga-directory:v1';
const CACHE_TTL = 6 * 60 * 60; // 6 hours

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();
const firstLast = (s: string) => {
  const p = norm(s).split(/\s+/).filter(Boolean);
  return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : norm(s);
};

type DirPlayer = { id: string; displayName: string };

async function loadDirectory(): Promise<DirPlayer[]> {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached as string) as DirPlayer[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fall through to fetch */ }
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': GQL_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query: `query Dir { playerDirectory(tourCode: R) { players { id displayName } } }` }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { playerDirectory?: { players?: DirPlayer[] } }; errors?: unknown[] };
    if (json.errors?.length) return [];
    const players = json?.data?.playerDirectory?.players ?? [];
    if (players.length > 0) { try { await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(players)); } catch { /* ignore */ } }
    return players;
  } catch {
    return [];
  }
}

export type PgaResolver = (name: string) => number | null;

// A no-op resolver used when the directory can't be loaded (network issue) — leaves pgaTourId at 0,
// which is retried on the next upload.
const NULL_RESOLVER: PgaResolver = () => null;

export async function getPgaDirectoryResolver(): Promise<PgaResolver> {
  const dir = await loadDirectory();
  if (dir.length === 0) return NULL_RESOLVER;
  const byNorm = new Map<string, number>();
  const byFL = new Map<string, number>();
  for (const p of dir) {
    const idNum = parseInt(String(p.id), 10);
    if (!Number.isFinite(idNum) || idNum <= 0) continue;
    const n = norm(p.displayName);
    if (!byNorm.has(n)) byNorm.set(n, idNum);
    const fl = firstLast(p.displayName);
    if (!byFL.has(fl)) byFL.set(fl, idNum);
  }
  return (name: string) => byNorm.get(norm(name)) ?? byFL.get(firstLast(name)) ?? null;
}
