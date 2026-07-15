import { requireAuth } from '../../../lib/budget/auth';
import { syncAllItems } from '../../../lib/budget/sync';

export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  const results = await syncAllItems();
  return Response.json({ results });
}
