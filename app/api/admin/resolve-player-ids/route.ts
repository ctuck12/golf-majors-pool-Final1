export const dynamic = 'force-dynamic';

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

// Resolves pgaTourId for pool players where pgaTourId === 0.
// Searches the PGA Tour playerDirectory via GQL and returns a mapping of
// player name → discovered pgaTourId so they can be manually updated in player-pool.ts.
// GET /api/admin/resolve-player-ids

const GQL_URL = 'https://orchestrator.pgatour.com/graphql';
const GQL_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function searchPgaTourDirectory(name: string): Promise<string | null> {
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': GQL_KEY },
      body: JSON.stringify({
        query: `query PlayerDirectory($search: String) {
          playerDirectory(search: $search, tourCode: PGA) {
            players { id displayName }
          }
        }`,
        variables: { search: name },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const players: { id: string; displayName: string }[] =
      json?.data?.playerDirectory?.players ?? [];
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
    const nameLower = norm(name);
    const match = players.find((p) => norm(p.displayName) === nameLower)
      ?? players.find((p) => norm(p.displayName).includes(nameLower.split(' ').slice(-1)[0]));
    return match?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const unresolved = PLAYER_POOL_WITH_PGA_IDS.filter((p) => p.pgaTourId === 0);

  if (unresolved.length === 0) {
    return Response.json({ message: 'All players have pgaTourId resolved.', resolved: {} });
  }

  const results: Record<string, { id: number; discovered: string | null }> = {};

  await Promise.all(
    unresolved.map(async (p) => {
      const discovered = await searchPgaTourDirectory(p.name);
      results[p.name] = { id: p.id, discovered };
    }),
  );

  const found = Object.entries(results).filter(([, v]) => v.discovered);
  const missing = Object.entries(results).filter(([, v]) => !v.discovered);

  return Response.json({
    totalUnresolved: unresolved.length,
    found: found.length,
    missing: missing.length,
    results,
    // Copy-paste these lines into player-pool.ts to fill in the IDs:
    snippets: found.map(
      ([name, v]) =>
        `  // ${name} (id ${v.id}) → pgaTourId: ${v.discovered}`,
    ),
  });
}
