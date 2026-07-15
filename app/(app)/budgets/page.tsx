'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAsyncEffect } from '../../components/useAsyncEffect';
import { CheckCircle2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_MAP } from '../../lib/budget/categories';
import type { Budgets, CategoryId, Transaction } from '../../lib/budget/types';
import {
  BudgetMeter,
  Card,
  CategoryDot,
  buttonPrimary,
  currentMonth,
  monthLabel,
  usd,
} from '../../components/ui';

export default function BudgetsPage() {
  const month = currentMonth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [budgetRes, txnRes] = await Promise.all([
      fetch('/api/budget/budgets'),
      fetch(`/api/budget/transactions?month=${month}`),
    ]);
    if (budgetRes.ok) {
      const { budgets } = (await budgetRes.json()) as { budgets: Budgets };
      setDrafts(
        Object.fromEntries(
          Object.entries(budgets).map(([k, v]) => [k, String(v)]),
        ),
      );
    }
    if (txnRes.ok) setTxns((await txnRes.json()).transactions);
    setLoading(false);
  }, [month]);

  useAsyncEffect(load);

  const spentByCategory = useMemo(() => {
    const map = new Map<CategoryId, number>();
    for (const t of txns) {
      if (t.hidden) continue;
      if (!CATEGORY_MAP[t.category]?.spending) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return map;
  }, [txns]);

  const save = async () => {
    setSaving(true);
    const budgets: Record<string, number> = {};
    for (const [key, value] of Object.entries(drafts)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) budgets[key] = n;
    }
    const res = await fetch('/api/budget/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgets }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const spendingCategories = CATEGORIES.filter((c) => c.spending);

  if (loading) {
    return <div className="py-20 text-center text-ink-muted text-[14px]">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold">Budgets</h1>
        <p className="text-[13px] text-ink-secondary mt-1">
          Monthly amounts per category. Progress shows {monthLabel(month)} spending; leave a
          category blank to skip budgeting it.
        </p>
      </div>

      <Card className="divide-y divide-hairline">
        {spendingCategories.map((c) => {
          const spent = Math.max(0, spentByCategory.get(c.id) ?? 0);
          const budget = Number(drafts[c.id]);
          return (
            <div key={c.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-medium">
                  <CategoryDot category={c.id} />
                  {c.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-ink-muted">$</span>
                  <input
                    inputMode="decimal"
                    value={drafts[c.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder="—"
                    className="w-24 rounded-lg border border-[rgba(11,11,11,0.15)] bg-surface px-2 py-1.5 text-[14px] text-right outline-none focus:border-accent"
                    aria-label={`Monthly budget for ${c.label}`}
                  />
                </div>
              </div>
              <div className="mt-2">
                {Number.isFinite(budget) && budget > 0 ? (
                  <BudgetMeter spent={spent} budget={budget} />
                ) : (
                  <div className="text-[12px] text-ink-muted">
                    {spent > 0 ? `${usd(spent)} spent this month — not budgeted` : 'Not budgeted'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <div className="flex items-center gap-3">
        <button className={buttonPrimary} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save budgets'}
        </button>
        {saved ? (
          <span className="flex items-center gap-1 text-[13px] text-good-text">
            <CheckCircle2 size={15} aria-hidden /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
