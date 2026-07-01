export const dynamic = 'force-dynamic';

import { getManualSalaries } from '@/app/lib/salary-overrides-store';

// Public read of the commissioner's uploaded salary list (pool id -> salary), consumed by the pick
// sheet. Returns an empty map when nothing is uploaded, so the client keeps its built-in salaries.
export async function GET() {
  const current = await getManualSalaries();
  return Response.json({ active: !!current, map: current?.map ?? {}, updatedAt: current?.updatedAt ?? null });
}
