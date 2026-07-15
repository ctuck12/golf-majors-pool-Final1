import { requireAuth } from '../../../../lib/budget/auth';
import { exchangePublicToken, isPlaidConfigured } from '../../../../lib/budget/plaid';
import { upsertItem } from '../../../../lib/budget/store';
import { syncItemById } from '../../../../lib/budget/sync';
import type { Item } from '../../../../lib/budget/types';

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  if (!isPlaidConfigured()) {
    return Response.json({ error: 'Plaid is not configured' }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const publicToken = typeof body?.publicToken === 'string' ? body.publicToken : '';
  if (!publicToken) return Response.json({ error: 'publicToken required' }, { status: 400 });

  try {
    const { access_token, item_id } = await exchangePublicToken(publicToken);
    const institutionName =
      typeof body?.institutionName === 'string' && body.institutionName
        ? body.institutionName
        : 'Bank';
    const item: Item = {
      id: item_id,
      demo: false,
      accessToken: access_token,
      institutionName,
      createdAt: new Date().toISOString(),
    };
    await upsertItem(item);
    const result = await syncItemById(item_id);
    return Response.json({ ok: true, itemId: item_id, sync: result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'exchange failed' },
      { status: 502 },
    );
  }
}
