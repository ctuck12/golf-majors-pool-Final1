import { requireAuth } from '../../../lib/budget/auth';
import { mergeManualDebtEdits, reconcileDebts } from '../../../lib/budget/debts';
import { DEFAULT_PLAN, sanitizeDebt } from '../../../lib/budget/plan';
import { getPlan, resetPlan, savePlan } from '../../../lib/budget/store';
import type { ExpectedInflow, MovePlan, PlanPhase, VariableTarget } from '../../../lib/budget/types';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  // Fold in any loan payments / linked-account balances synced since the
  // last look, so the plan is always current when it loads.
  await reconcileDebts().catch(() => {});
  return Response.json({ plan: await getPlan() });
}

const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

function sanitizePlan(raw: Partial<MovePlan>): MovePlan {
  const base = raw.baseline ?? DEFAULT_PLAN.baseline;
  return {
    targetWindow: str(raw.targetWindow, DEFAULT_PLAN.targetWindow),
    baseline: {
      income: num(base.income),
      recurringBills: num(base.recurringBills),
      variableSpending: num(base.variableSpending),
    },
    saleEquity: num(raw.saleEquity),
    downPayment: num(raw.downPayment),
    inflows: (Array.isArray(raw.inflows) ? raw.inflows : []).map(
      (i: Partial<ExpectedInflow>, idx): ExpectedInflow => ({
        id: str(i.id) || `inflow-${idx}`,
        name: str(i.name, 'Expected money'),
        amount: num(i.amount),
        expectedDate: str(i.expectedDate) || undefined,
        received: Boolean(i.received),
        notes: str(i.notes) || undefined,
      }),
    ),
    debts: (Array.isArray(raw.debts) ? raw.debts : []).map(sanitizeDebt),
    phases: (Array.isArray(raw.phases) ? raw.phases : DEFAULT_PLAN.phases).map(
      (p: Partial<PlanPhase>, idx): PlanPhase => ({
        id: str(p.id) || `phase-${idx}`,
        label: str(p.label, `Phase ${idx + 1}`),
        income: num(p.income),
        mortgage: num(p.mortgage),
        recurringBills: num(p.recurringBills),
        giving: num(p.giving),
        carPayment: num(p.carPayment),
        savingsPct: num(p.savingsPct),
        investPct: num(p.investPct),
        notes: str(p.notes) || undefined,
      }),
    ),
    variableTargets: (Array.isArray(raw.variableTargets) ? raw.variableTargets : []).map(
      (t: Partial<VariableTarget>): VariableTarget => ({
        label: str(t.label, 'Category'),
        amount: num(t.amount),
        note: str(t.note) || undefined,
      }),
    ),
    currentVariableRunRate: num(raw.currentVariableRunRate, DEFAULT_PLAN.currentVariableRunRate),
  };
}

export async function PUT(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body?.plan || typeof body.plan !== 'object') {
    return Response.json({ error: 'plan object required' }, { status: 400 });
  }
  const plan = sanitizePlan(body.plan as Partial<MovePlan>);
  const previous = await getPlan();
  const today = new Date().toISOString().slice(0, 10);
  plan.debts = mergeManualDebtEdits(previous.debts, plan.debts, today);
  await savePlan(plan);
  await reconcileDebts().catch(() => {});
  return Response.json({ plan: await getPlan() });
}

// Restore the spreadsheet defaults.
export async function DELETE() {
  const denied = await requireAuth();
  if (denied) return denied;
  await resetPlan();
  return Response.json({ plan: DEFAULT_PLAN });
}
