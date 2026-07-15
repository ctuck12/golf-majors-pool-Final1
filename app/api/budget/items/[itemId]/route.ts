import { requireAuth } from '../../../../lib/budget/auth';
import { removePlaidItem } from '../../../../lib/budget/plaid';
import { getItems, removeItemData } from '../../../../lib/budget/store';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { itemId } = await params;
  const items = await getItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!item.demo && item.accessToken) {
    // Best effort — still remove locally if Plaid errors.
    await removePlaidItem(item.accessToken).catch(() => {});
  }
  await removeItemData(itemId);
  return Response.json({ ok: true });
}
