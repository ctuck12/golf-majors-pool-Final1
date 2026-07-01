export const dynamic = 'force-dynamic';

import { getManualSalaries } from '@/app/lib/salary-overrides-store';

// Public read of the commissioner's uploaded pick list, consumed by the pick sheet. Returns split
// id->salary and id->worldRank maps. Empty when nothing is uploaded, so the client keeps its built-ins.
export async function GET() {
  const current = await getManualSalaries();
  const salaries: Record<number, number> = {};
  const worldRanks: Record<number, number> = {};
  if (current) {
    for (const [id, entry] of Object.entries(current.map)) {
      salaries[Number(id)] = entry.salary;
      if (typeof entry.worldRank === 'number' && entry.worldRank > 0) worldRanks[Number(id)] = entry.worldRank;
    }
  }
  return Response.json({ active: !!current, salaries, worldRanks, updatedAt: current?.updatedAt ?? null });
}
