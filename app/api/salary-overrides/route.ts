export const dynamic = 'force-dynamic';

import { getManualSalaries } from '@/app/lib/salary-overrides-store';
import { getDynamicPlayers } from '@/app/lib/dynamic-pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { canonicalNameKey } from '@/app/lib/name-match';

// Public read of the commissioner's uploaded pick list, consumed by the pick sheet. Returns split
// id->salary and id->worldRank maps. Empty when nothing is uploaded, so the client keeps its built-ins.
// Also returns any auto-added dynamic players (from salary uploads whose names weren't in the static
// pool) so the client merges them into the pick list. Dynamic players since backfilled into the static
// pool are dropped here (matched by name) so they never appear twice.
export async function GET() {
  const [current, dynamicRaw] = await Promise.all([getManualSalaries(), getDynamicPlayers()]);
  const salaries: Record<number, number> = {};
  const worldRanks: Record<number, number> = {};
  if (current) {
    for (const [id, entry] of Object.entries(current.map)) {
      salaries[Number(id)] = entry.salary;
      if (typeof entry.worldRank === 'number' && entry.worldRank > 0) worldRanks[Number(id)] = entry.worldRank;
    }
  }
  const staticCanon = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => canonicalNameKey(p.name)));
  const dynamicPlayers = dynamicRaw
    .filter((p) => !staticCanon.has(canonicalNameKey(p.name)))
    .map((p) => ({ id: p.id, name: p.name, pgaTourId: p.pgaTourId, worldRank: p.worldRank, defaultOdds: p.defaultOdds }));
  return Response.json({ active: !!current, salaries, worldRanks, dynamicPlayers, updatedAt: current?.updatedAt ?? null });
}
