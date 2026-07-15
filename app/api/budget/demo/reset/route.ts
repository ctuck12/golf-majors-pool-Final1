import { requireAuth } from '../../../../lib/budget/auth';
import { DEMO_ITEM_ID } from '../../../../lib/budget/demo';
import { removeItemData } from '../../../../lib/budget/store';

// Removes the demo bank, its accounts, and its transactions. Budgets and
// goals are left alone (they may have been edited into real ones).
export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  await removeItemData(DEMO_ITEM_ID);
  return Response.json({ ok: true });
}
