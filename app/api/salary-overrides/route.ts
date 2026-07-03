export const dynamic = 'force-dynamic';

import { getAllManualSalaries } from '@/app/lib/salary-overrides-store';
import { getDynamicPlayers } from '@/app/lib/dynamic-pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { canonicalNameKey } from '@/app/lib/name-match';
import { applyNameAlias } from '@/app/lib/name-aliases';
import { ALL_TOURNAMENT_IDS, getHeaderTournament } from '@/app/lib/tournament-logo';

// Public read of the commissioner's uploaded pick lists, consumed by the pick sheet + standings.
// Salary lists are stored PER TOURNAMENT, so this returns a byTournament map (id -> {salaries,
// worldRanks}) covering every event with an uploaded list — the client uses the current tournament's
// map to build the pick sheet and each viewed tournament's map to show historical standings salaries.
// For backward compatibility it also returns the CURRENT tournament's salaries/worldRanks flat.
// Also returns any auto-added dynamic players (from salary uploads whose names weren't in the static
// pool). Dynamic players since backfilled into the static pool are dropped here (matched by name).
export async function GET() {
  const [byTid, dynamicRaw] = await Promise.all([
    getAllManualSalaries(ALL_TOURNAMENT_IDS),
    getDynamicPlayers(),
  ]);

  const byTournament: Record<string, { salaries: Record<number, number>; worldRanks: Record<number, number>; updatedAt: string | null }> = {};
  for (const [tid, list] of Object.entries(byTid)) {
    const salaries: Record<number, number> = {};
    const worldRanks: Record<number, number> = {};
    for (const [id, entry] of Object.entries(list.map)) {
      salaries[Number(id)] = entry.salary;
      if (typeof entry.worldRank === 'number' && entry.worldRank > 0) worldRanks[Number(id)] = entry.worldRank;
    }
    byTournament[tid] = { salaries, worldRanks, updatedAt: list.updatedAt };
  }

  const currentId = getHeaderTournament().id;
  const current = byTournament[currentId];

  // Drop dynamic players that are really a static pool player under an alias (e.g. a prior upload added
  // "Benjamin James" before the alias existed — it maps to "Ben James", so hide the duplicate).
  const staticCanon = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => canonicalNameKey(p.name)));
  const dynamicPlayers = dynamicRaw
    .filter((p) => !staticCanon.has(canonicalNameKey(applyNameAlias(p.name))))
    .map((p) => ({ id: p.id, name: p.name, pgaTourId: p.pgaTourId, worldRank: p.worldRank, defaultOdds: p.defaultOdds }));

  return Response.json({
    active: !!current,
    byTournament,
    currentTournamentId: currentId,
    salaries: current?.salaries ?? {},   // back-compat: current tournament's flat maps
    worldRanks: current?.worldRanks ?? {},
    dynamicPlayers,
    updatedAt: current?.updatedAt ?? null,
  });
}
