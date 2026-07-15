import { requireAuth } from '../../../lib/budget/auth';
import { isCategoryId } from '../../../lib/budget/categories';
import { getBudgets, saveBudgets } from '../../../lib/budget/store';
import type { Budgets } from '../../../lib/budget/types';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return Response.json({ budgets: await getBudgets() });
}

export async function PUT(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body?.budgets || typeof body.budgets !== 'object') {
    return Response.json({ error: 'budgets object required' }, { status: 400 });
  }
  const budgets: Budgets = {};
  for (const [key, value] of Object.entries(body.budgets as Record<string, unknown>)) {
    const amount = Number(value);
    if (isCategoryId(key) && Number.isFinite(amount) && amount > 0) {
      budgets[key] = Math.round(amount * 100) / 100;
    }
  }
  await saveBudgets(budgets);
  return Response.json({ budgets });
}
