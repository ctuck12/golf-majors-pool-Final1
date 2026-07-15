'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP } from '../lib/budget/categories';
import type { Account, Budgets, CategoryId, Goal, Transaction } from '../lib/budget/types';
import {
  BudgetMeter,
  Card,
  CategoryDot,
  EmptyState,
  ProgressBar,
  StatTile,
  buttonSecondary,
  currentMonth,
  dateLabel,
  monthLabel,
  shiftMonth,
  usd,
  usdWhole,
} from '../components/ui';
import PlaidLinkButton from '../components/PlaidLinkButton';
import { useAsyncEffect } from '../components/useAsyncEffect';

interface Config {
  plaidConfigured: boolean;
  hasData: boolean;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [config, setConfig] = useState<Config | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const [configRes, txnRes, budgetRes, goalRes, accountRes] = await Promise.all([
      fetch('/api/budget/config'),
      fetch(`/api/budget/transactions?month=${month}`),
      fetch('/api/budget/budgets'),
      fetch('/api/budget/goals'),
      fetch('/api/budget/accounts'),
    ]);
    if (configRes.ok) setConfig(await configRes.json());
    if (txnRes.ok) setTxns((await txnRes.json()).transactions);
    if (budgetRes.ok) setBudgets((await budgetRes.json()).budgets);
    if (goalRes.ok) setGoals((await goalRes.json()).goals);
    if (accountRes.ok) setAccounts((await accountRes.json()).accounts);
    setLoading(false);
  }, [month]);

  useAsyncEffect(load);

  const seedDemo = async () => {
    setSeeding(true);
    await fetch('/api/budget/demo/seed', { method: 'POST' });
    await load();
    setSeeding(false);
  };

  const visible = useMemo(() => txns.filter((t) => !t.hidden), [txns]);

  const stats = useMemo(() => {
    let income = 0;
    let spent = 0;
    const byCategory = new Map<CategoryId, number>();
    for (const t of visible) {
      const def = CATEGORY_MAP[t.category];
      if (t.category === 'income') {
        income += -t.amount;
      } else if (def?.spending) {
        spent += t.amount;
        byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
      }
    }
    return { income, spent, byCategory };
  }, [visible]);

  const budgeted = useMemo(
    () =>
      CATEGORIES.filter((c) => budgets[c.id])
        .map((c) => ({
          def: c,
          budget: budgets[c.id]!,
          spent: Math.max(0, stats.byCategory.get(c.id) ?? 0),
        }))
        .sort((a, b) => b.spent / b.budget - a.spent / a.budget),
    [budgets, stats],
  );
  const budgetTotal = budgeted.reduce((s, b) => s + b.budget, 0);
  const budgetSpent = budgeted.reduce((s, b) => s + Math.min(b.spent, b.budget), 0);

  const cash = accounts
    .filter((a) => a.type === 'depository')
    .reduce((s, a) => s + a.balanceCurrent, 0);
  const cardDebt = accounts
    .filter((a) => a.type === 'credit')
    .reduce((s, a) => s + a.balanceCurrent, 0);

  const recent = visible.slice(0, 8);

  if (loading) {
    return <div className="py-20 text-center text-ink-muted text-[14px]">Loading…</div>;
  }

  if (config && !config.hasData) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white text-[22px] font-bold">
            $
          </div>
          <h1 className="mt-4 text-[20px] font-semibold">Welcome to your Family Budget</h1>
          <p className="mt-2 text-[14px] text-ink-secondary">
            Connect your bank and credit cards to see every dollar in one place — or explore with
            demo data first.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            {config.plaidConfigured ? (
              <PlaidLinkButton onLinked={load} />
            ) : (
              <p className="text-[13px] text-ink-muted">
                Bank linking is off until Plaid keys are added (see the Accounts page).
              </p>
            )}
            <button className={buttonSecondary} onClick={seedDemo} disabled={seeding}>
              <Sparkles size={16} aria-hidden />
              {seeding ? 'Setting up…' : 'Try it with demo data'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Overview</h1>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous month"
            className="p-1.5 rounded-lg hover:bg-hairline/60 text-ink-secondary"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-[14px] font-medium w-36 text-center">{monthLabel(month)}</span>
          <button
            aria-label="Next month"
            className="p-1.5 rounded-lg hover:bg-hairline/60 text-ink-secondary disabled:opacity-30"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= currentMonth()}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Income" value={usd(stats.income)} tone="good" />
        <StatTile label="Spent" value={usd(stats.spent)} />
        <StatTile
          label="Budget left"
          value={usd(Math.max(budgetTotal - budgetSpent, 0))}
          sub={budgetTotal ? `of ${usdWhole(budgetTotal)} budgeted` : 'no budgets set'}
        />
        <StatTile
          label="Cash minus cards"
          value={usd(cash - cardDebt)}
          sub={cardDebt > 0 ? `${usd(cardDebt)} on cards` : undefined}
        />
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-[15px] font-semibold">Budgets</h2>
          <Link href="/budgets" className="text-[13px] text-accent-deep hover:underline">
            Edit budgets
          </Link>
        </div>
        {budgeted.length === 0 ? (
          <EmptyState title="No budgets yet">
            Set monthly amounts on the <Link href="/budgets" className="text-accent-deep underline">Budgets</Link> page.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-hairline">
            {budgeted.map(({ def, budget, spent }) => (
              <div key={def.id} className="p-4">
                <div className="flex items-center justify-between text-[14px] mb-1.5">
                  <span className="flex items-center gap-2 font-medium">
                    <CategoryDot category={def.id} />
                    {def.label}
                  </span>
                  <span className="text-ink-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {usd(spent)} <span className="text-ink-muted">/ {usdWhole(budget)}</span>
                  </span>
                </div>
                <BudgetMeter spent={spent} budget={budget} />
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[15px] font-semibold">Recent activity</h2>
            <Link href="/transactions" className="text-[13px] text-accent-deep hover:underline">
              See all
            </Link>
          </div>
          <Card className="divide-y divide-hairline">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-ink-muted">
                No transactions this month.
              </div>
            ) : (
              recent.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                  <CategoryDot category={t.category} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.merchant || t.name}</div>
                    <div className="text-[12px] text-ink-muted">{dateLabel(t.date)}</div>
                  </div>
                  <div
                    className={t.amount < 0 ? 'text-good-text font-medium' : ''}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t.amount < 0 ? `+${usd(-t.amount)}` : usd(t.amount)}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[15px] font-semibold">Goals</h2>
            <Link href="/goals" className="text-[13px] text-accent-deep hover:underline">
              Manage
            </Link>
          </div>
          {goals.length === 0 ? (
            <EmptyState title="No goals yet">
              Add a savings goal on the <Link href="/goals" className="text-accent-deep underline">Goals</Link> page.
            </EmptyState>
          ) : (
            <Card className="divide-y divide-hairline">
              {goals.map((g) => (
                <div key={g.id} className="p-4">
                  <div className="flex items-center justify-between text-[14px] mb-1.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-ink-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {usdWhole(g.saved)} <span className="text-ink-muted">/ {usdWhole(g.target)}</span>
                    </span>
                  </div>
                  <ProgressBar ratio={g.target > 0 ? g.saved / g.target : 0} />
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
