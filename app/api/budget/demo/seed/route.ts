import { requireAuth } from '../../../../lib/budget/auth';
import { seedDemoData } from '../../../../lib/budget/demo';

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  const result = await seedDemoData();
  return Response.json({ ok: true, ...result });
}
