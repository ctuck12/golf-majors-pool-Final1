export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { PLAYER_POOL_WITH_PGA_IDS, PLAYER_ARCHIVE } from '@/app/lib/player-pool';
import { getEspnId } from '@/app/lib/espn-player-season';

const BATCH = 10;

// Resolves each pool/archive player's ESPN athlete id (used to build the ESPN headshot URL
// a.espncdn.com/i/headshots/golf/players/full/{id}.png). Returns a name -> espnId map to paste
// into app/lib/player-espn-ids.ts so list/roster photos can use the same source as the bio popup.
export async function GET() {
  const players = [...PLAYER_POOL_WITH_PGA_IDS, ...PLAYER_ARCHIVE];
  const map: Record<string, string> = {};
  const missing: string[] = [];

  for (let i = 0; i < players.length; i += BATCH) {
    const batch = players.slice(i, i + BATCH);
    await Promise.all(batch.map(async (p) => {
      const id = await getEspnId(p.name).catch(() => null);
      if (id) map[p.name] = id; else missing.push(p.name);
    }));
  }

  // Emit a ready-to-paste object literal, sorted by name.
  const lines = Object.keys(map).sort().map((n) => `  ${JSON.stringify(n)}: '${map[n]}',`);
  return Response.json({
    resolved: Object.keys(map).length,
    missing: missing.length,
    missingNames: missing,
    literal: `{\n${lines.join('\n')}\n}`,
  });
}
