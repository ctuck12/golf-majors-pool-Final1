// Move & payoff plan: defaults seeded from the Tucker Household budget
// spreadsheet (built from Apr–Jun 2026 Citi/Chase/First Financial
// statements) and the 30/40/15/15 move-plan tab. Everything is editable in
// the app; these are the starting values.
import type { Debt, MovePlan, PlanPhase } from './types';

export const DEFAULT_PLAN: MovePlan = {
  targetWindow: 'Jan – Mar 2027 (6–8 months out)',
  baseline: {
    income: 11281.58, // 3-cycle average; excludes the one-time April IRS refund
    recurringBills: 6120.01,
    variableSpending: 7794.91,
  },
  saleEquity: 130000,
  downPayment: 56000,
  inflows: [
    {
      id: 'irs-refund',
      name: 'IRS tax refund',
      amount: 6000,
      received: false,
      notes: 'Expected in the next 4–6 weeks. Earmarked for the Citi balance (29.99% APR) until the sale closes.',
    },
  ],
  debts: [
    {
      id: 'student-loan',
      name: 'Student loan (Dept of Education)',
      balance: 23784,
      payment: 365.93,
      payoffAtSale: true,
    },
    {
      id: 'sofi',
      name: 'SoFi personal loan',
      balance: 20369,
      payment: 403.95,
      payoffAtSale: true,
    },
    {
      id: 'best-buy',
      name: 'Best Buy card',
      balance: 5478,
      payment: 216.67,
      payoffAtSale: true,
      notes: 'Payments have been $150–250/mo',
    },
    {
      id: 'car-loan',
      name: 'Car loan (First Watch)',
      balance: 12337,
      payment: 892.17,
      payoffAtSale: true,
      notes: 'Drafted on the 1st each month',
    },
    {
      id: 'citi',
      name: 'Citi card',
      balance: 4451.33,
      apr: 29.99,
      payoffAtSale: true,
      notes: 'As of 6/22 statement — the tax refund covers most of this',
    },
    {
      id: 'chase',
      name: 'Chase card',
      balance: 4294.96,
      apr: 21.49,
      payoffAtSale: true,
      notes: '21.49% purchase / 28.49% cash-advance APR (as of 6/27 statement)',
    },
    {
      id: 'lowes',
      name: "Lowe's card (Synchrony)",
      balance: 0,
      payment: 114.8,
      payoffAtSale: false,
      notes: 'Underlying balance not visible from statements — fill in',
    },
  ],
  phases: [
    {
      id: 'phase-1',
      label: 'Phase 1 · After move (to Feb 2027)',
      income: 11281.58,
      mortgage: 3500,
      recurringBills: 2080.67,
      giving: 400,
      carPayment: 0,
      savingsPct: 15,
      investPct: 10,
      notes: 'Bills after payoffs: childcare, utilities, insurance, subscriptions, Lowe’s card',
    },
    {
      id: 'phase-2',
      label: 'Phase 2 · Mar 2027+',
      income: 12279.58,
      mortgage: 3500,
      recurringBills: 2080.67,
      giving: 400,
      carPayment: 0,
      savingsPct: 15,
      investPct: 10,
      notes: 'Adds $499 × 2 paychecks/mo when the 401(k) loan finishes repaying',
    },
    {
      id: 'phase-3',
      label: 'Phase 3 · Mid 2027+ (adds car)',
      income: 12279.58,
      mortgage: 3500,
      recurringBills: 2080.67,
      giving: 400,
      carPayment: 450,
      savingsPct: 15,
      investPct: 10,
      notes: 'Wife’s car payment, $400–500/mo estimate',
    },
  ],
  variableTargets: [
    { label: 'Groceries & warehouse', amount: 1100, note: '$1,897 now' },
    { label: 'Dining, entertainment & travel', amount: 400, note: '$1,589 now' },
    { label: 'Clothing & online shopping', amount: 300, note: '$2,480 now' },
    { label: 'Coffee shops', amount: 60, note: '$201 now' },
    { label: 'Kids, pets & misc household', amount: 125, note: '$222 now' },
    { label: 'Health, pharmacy & personal care', amount: 125, note: '$272 now' },
    { label: 'Fuel & convenience', amount: 80, note: '$79 now' },
    { label: 'Home improvement & electronics', amount: 75, note: '$204 now' },
    { label: 'Home services & professional', amount: 100, note: '$444 now (lumpy — CPA, pest, HVAC)' },
    { label: 'Digital & one-off purchases', amount: 35, note: '$208 now' },
    { label: 'Venmo & cash advances', amount: 0, note: '$199 now — use free bank transfers instead' },
  ],
  currentVariableRunRate: 7794.91,
};

// ---- Pure math shared by the Plan page and dashboard card ----

export function planMath(plan: MovePlan) {
  const payoffDebts = plan.debts.filter((d) => d.payoffAtSale);
  const payoffTotal = payoffDebts.reduce((s, d) => s + d.balance, 0);
  const freedMonthly = payoffDebts.reduce((s, d) => s + (d.payment ?? 0), 0);
  const totalDebt = plan.debts.reduce((s, d) => s + d.balance, 0);
  const totalDebtPayments = plan.debts.reduce((s, d) => s + (d.payment ?? 0), 0);
  const inflowTotal = plan.inflows.reduce((s, i) => s + i.amount, 0);
  const equityAfterDown = plan.saleEquity - plan.downPayment;
  const cashAfterPayoffs = equityAfterDown + inflowTotal - payoffTotal;
  return {
    payoffTotal,
    freedMonthly,
    totalDebt,
    totalDebtPayments,
    inflowTotal,
    equityAfterDown,
    cashAfterPayoffs,
  };
}

export function phaseMath(phase: PlanPhase, runRate: number) {
  const savings = (phase.income * phase.savingsPct) / 100;
  const invest = (phase.income * phase.investPct) / 100;
  const allowance =
    phase.income -
    phase.mortgage -
    phase.recurringBills -
    phase.giving -
    phase.carPayment -
    savings -
    invest;
  return {
    savings,
    invest,
    allowance,
    mortgagePct: phase.income > 0 ? phase.mortgage / phase.income : 0,
    requiredReduction: Math.max(0, runRate - allowance),
  };
}

export function baselineNet(plan: MovePlan) {
  return plan.baseline.income - plan.baseline.recurringBills - plan.baseline.variableSpending;
}

export function sanitizeDebt(d: Partial<Debt>, index: number): Debt {
  return {
    id: typeof d.id === 'string' && d.id ? d.id : `debt-${index}`,
    name: typeof d.name === 'string' ? d.name : 'Debt',
    balance: Number(d.balance) || 0,
    payment: d.payment === undefined || d.payment === null ? undefined : Number(d.payment) || 0,
    apr: d.apr === undefined || d.apr === null ? undefined : Number(d.apr) || 0,
    payoffAtSale: Boolean(d.payoffAtSale),
    notes: typeof d.notes === 'string' && d.notes ? d.notes : undefined,
  };
}
