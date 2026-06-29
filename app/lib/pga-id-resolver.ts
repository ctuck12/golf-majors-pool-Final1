import redis from './redis';

// Resolve a PGA Tour player ID from a player name using the PGA Tour GraphQL player directory.
// Used when the pool record has no pgaTourId (0) so season stats (SG, scrambling, ranks) can
// still be fetched. Results are Redis-cached as a name→id map for 6 hours.

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const MAP_CACHE_KEY = 'pga-name-id-map:v1';

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae')
    .replace(/[^a-z ]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

type DirPlayer = { id?: string; firstName?: string; lastName?: string; displayName?: string };

async function buildNameIdMap(): Promise<Record<string, string>> {
  // Try cache first
  try {
    const cached = await redis.get(MAP_CACHE_KEY);
    if (cached) return JSON.parse(cached) as Record<string, string>;
  } catch { /* ignore */ }

  const query = `
    query PlayerDirectory {
      playerDirectory(tourCode: R) {
        players { id firstName lastName displayName }
      }
    }
  `;
  const map: Record<string, string> = {};
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return map;
    const data = await res.json() as { data?: { playerDirectory?: { players?: DirPlayer[] } } };
    const players = data?.data?.playerDirectory?.players ?? [];
    for (const p of players) {
      if (!p.id) continue;
      const full = (p.firstName && p.lastName) ? `${p.firstName} ${p.lastName}` : (p.displayName ?? '');
      const key = norm(full);
      if (key) map[key] = String(p.id);
    }
    if (Object.keys(map).length > 0) {
      try { await redis.setex(MAP_CACHE_KEY, 21600, JSON.stringify(map)); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return map;
}

// Returns the PGA Tour player ID for the given name, or null if not found.
export async function resolvePgaTourIdByName(name: string): Promise<string | null> {
  const target = norm(name);
  if (!target) return null;
  const map = await buildNameIdMap();
  return map[target] ?? null;
}

// Debug helper: expose directory size for verification.
export async function debugDirectorySize(): Promise<number> {
  const map = await buildNameIdMap();
  return Object.keys(map).length;
}
