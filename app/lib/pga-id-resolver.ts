import redis from './redis';

// Resolve a PGA Tour player ID from a player name using the public PGA Tour player directory.
// Used when the pool record has no pgaTourId (0), so season stats (SG, scrambling, ranks) can
// still be fetched from PGA Tour GQL. The directory is Redis-cached (shared with the bio route).

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae')
    .replace(/[^a-z ]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

type DirPlayer = Record<string, unknown>;

function playerFullName(p: DirPlayer): string {
  // PGA player.json uses varying field names across versions; try the common ones.
  const first = (p.nameF ?? p.firstName ?? p.first ?? p.fName) as string | undefined;
  const last = (p.nameL ?? p.lastName ?? p.last ?? p.lName) as string | undefined;
  if (first && last) return `${first} ${last}`;
  const full = (p.name ?? p.pname ?? p.displayName ?? p.fullName) as string | undefined;
  // Directory `name` is often "Last, First" — normalize to "First Last"
  if (full && full.includes(',')) {
    const [l, f] = full.split(',').map((x) => x.trim());
    return `${f} ${l}`;
  }
  return full ?? '';
}

async function loadDirectory(): Promise<DirPlayer[]> {
  let raw: string | null = null;
  try { raw = await redis.get('pga-rest-players:v1'); } catch { /* ignore */ }
  if (!raw) {
    try {
      const res = await fetch('https://statdata.pgatour.com/players/player.json', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: { 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      });
      if (!res.ok) return [];
      raw = await res.text();
      try { await redis.setex('pga-rest-players:v1', 21600, raw); } catch { /* ignore */ }
    } catch { return []; }
  }
  try {
    const data = JSON.parse(raw) as { plrs?: DirPlayer[] };
    return data.plrs ?? [];
  } catch { return []; }
}

// Returns the PGA Tour player ID (pid) for the given name, or null if not found.
export async function resolvePgaTourIdByName(name: string): Promise<string | null> {
  const target = norm(name);
  if (!target) return null;
  const players = await loadDirectory();
  for (const p of players) {
    if (norm(playerFullName(p)) === target) {
      const pid = String(p.pid ?? p.id ?? p.playerId ?? '');
      if (pid && pid !== '0') return pid;
    }
  }
  return null;
}
