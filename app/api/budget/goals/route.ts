import { randomUUID } from 'crypto';
import { requireAuth } from '../../../lib/budget/auth';
import { getGoals, saveGoals } from '../../../lib/budget/store';
import type { Goal } from '../../../lib/budget/types';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  return Response.json({ goals: await getGoals() });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const target = Number(body?.target);
  if (!name || !Number.isFinite(target) || target <= 0) {
    return Response.json({ error: 'name and positive target required' }, { status: 400 });
  }
  const goal: Goal = {
    id: randomUUID(),
    name,
    target: Math.round(target * 100) / 100,
    saved: Math.max(0, Number(body?.saved) || 0),
    targetDate: typeof body?.targetDate === 'string' && body.targetDate ? body.targetDate : undefined,
    createdAt: new Date().toISOString(),
  };
  const goals = await getGoals();
  goals.push(goal);
  await saveGoals(goals);
  return Response.json({ goal });
}

export async function PATCH(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
  const goals = await getGoals();
  const goal = goals.find((g) => g.id === body.id);
  if (!goal) return Response.json({ error: 'Not found' }, { status: 404 });

  if (typeof body.name === 'string' && body.name.trim()) goal.name = body.name.trim();
  if (Number.isFinite(Number(body.target)) && Number(body.target) > 0) {
    goal.target = Math.round(Number(body.target) * 100) / 100;
  }
  if (Number.isFinite(Number(body.saved)) && Number(body.saved) >= 0) {
    goal.saved = Math.round(Number(body.saved) * 100) / 100;
  }
  if (Number.isFinite(Number(body.addAmount))) {
    goal.saved = Math.max(0, Math.round((goal.saved + Number(body.addAmount)) * 100) / 100);
  }
  if (typeof body.targetDate === 'string') goal.targetDate = body.targetDate || undefined;

  await saveGoals(goals);
  return Response.json({ goal });
}

export async function DELETE(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const goals = await getGoals();
  await saveGoals(goals.filter((g) => g.id !== id));
  return Response.json({ ok: true });
}
