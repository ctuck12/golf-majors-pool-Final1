import { requireAuth } from '../../../lib/budget/auth';
import { isCategoryId } from '../../../lib/budget/categories';
import { getTransactions, saveTransactions } from '../../../lib/budget/store';

export async function GET(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM, optional
  let txns = await getTransactions();
  if (month) txns = txns.filter((t) => t.date.startsWith(month));
  return Response.json({ transactions: txns });
}

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });

  const txns = await getTransactions();
  const txn = txns.find((t) => t.id === body.id);
  if (!txn) return Response.json({ error: 'Not found' }, { status: 404 });

  if (body.category !== undefined) {
    if (!isCategoryId(body.category)) {
      return Response.json({ error: 'Invalid category' }, { status: 400 });
    }
    txn.category = body.category;
    txn.categoryOverridden = true;
  }
  if (body.hidden !== undefined) txn.hidden = Boolean(body.hidden);

  await saveTransactions(txns);
  return Response.json({ transaction: txn });
}
