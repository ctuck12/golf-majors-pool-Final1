// Plaid webhook receiver. Transaction webhooks trigger a sync of the
// affected item, which is what keeps the app near-real-time. The handler
// only ever triggers a re-sync (idempotent, reads via our stored access
// token), so it is safe to leave unauthenticated.
import { getItems } from '../../../../lib/budget/store';
import { syncItem } from '../../../../lib/budget/sync';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const webhookType = body?.webhook_type as string | undefined;
  const plaidItemId = body?.item_id as string | undefined;

  if (webhookType === 'TRANSACTIONS' && plaidItemId) {
    const items = await getItems();
    const item = items.find((i) => i.id === plaidItemId);
    if (item) {
      try {
        await syncItem(item);
      } catch {
        // Plaid retries failed webhooks; next delivery or cron will catch up.
      }
    }
  }
  return Response.json({ ok: true });
}
