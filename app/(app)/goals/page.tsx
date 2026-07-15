'use client';

import { useCallback, useState } from 'react';
import { useAsyncEffect } from '../../components/useAsyncEffect';
import { Plus, Trash2 } from 'lucide-react';
import type { Goal } from '../../lib/budget/types';
import {
  Card,
  EmptyState,
  ProgressBar,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  usd,
  usdWhole,
} from '../../components/ui';

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [addAmounts, setAddAmounts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/budget/goals');
    if (res.ok) setGoals((await res.json()).goals);
    setLoading(false);
  }, []);

  useAsyncEffect(load);

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/budget/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        target: Number(target),
        saved: Number(saved) || 0,
        targetDate: targetDate || undefined,
      }),
    });
    if (res.ok) {
      setName('');
      setTarget('');
      setSaved('');
      setTargetDate('');
      setShowForm(false);
      load();
    }
  };

  const contribute = async (id: string) => {
    const amount = Number(addAmounts[id]);
    if (!Number.isFinite(amount) || amount === 0) return;
    const res = await fetch('/api/budget/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, addAmount: amount }),
    });
    if (res.ok) {
      setAddAmounts((a) => ({ ...a, [id]: '' }));
      load();
    }
  };

  const remove = async (goal: Goal) => {
    if (!confirm(`Delete goal “${goal.name}”?`)) return;
    await fetch(`/api/budget/goals?id=${encodeURIComponent(goal.id)}`, { method: 'DELETE' });
    load();
  };

  if (loading) {
    return <div className="py-20 text-center text-ink-muted text-[14px]">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Goals</h1>
        <button className={buttonPrimary} onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} aria-hidden /> New goal
        </button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={createGoal} className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Goal name (e.g. New car)"
              className={inputClass}
              required
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Target amount ($)"
              inputMode="decimal"
              className={inputClass}
              required
            />
            <input
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
              placeholder="Already saved ($, optional)"
              inputMode="decimal"
              className={inputClass}
            />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
              aria-label="Target date (optional)"
            />
            <div className="sm:col-span-2">
              <button type="submit" className={buttonPrimary}>
                Add goal
              </button>
            </div>
          </form>
        </Card>
      )}

      {goals.length === 0 ? (
        <EmptyState title="No goals yet">
          Add a savings goal — an emergency fund, a vacation, a new car — and track it here.
        </EmptyState>
      ) : (
        goals.map((g) => {
          const ratio = g.target > 0 ? g.saved / g.target : 0;
          const done = g.saved >= g.target;
          return (
            <Card key={g.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold">{g.name}</div>
                  <div className="text-[13px] text-ink-secondary mt-0.5">
                    {usdWhole(g.saved)} of {usdWhole(g.target)} ({Math.round(ratio * 100)}%)
                    {g.targetDate ? ` · by ${g.targetDate}` : ''}
                    {done ? ' · reached 🎉' : ''}
                  </div>
                </div>
                <button
                  aria-label={`Delete ${g.name}`}
                  className="p-1.5 text-ink-muted hover:text-critical"
                  onClick={() => remove(g)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3">
                <ProgressBar ratio={ratio} color={done ? 'var(--color-good)' : 'var(--color-accent)'} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={addAmounts[g.id] ?? ''}
                  onChange={(e) => setAddAmounts((a) => ({ ...a, [g.id]: e.target.value }))}
                  placeholder="Add amount"
                  inputMode="decimal"
                  className={`${inputClass} w-32`}
                  aria-label={`Add money to ${g.name}`}
                />
                <button className={buttonSecondary} onClick={() => contribute(g.id)}>
                  Add money
                </button>
                {!done && g.targetDate ? (
                  <span className="ml-auto text-[12px] text-ink-muted">
                    {usd(g.target - g.saved)} to go
                  </span>
                ) : null}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
