'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAsyncEffect } from '../../components/useAsyncEffect';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search } from 'lucide-react';
import { CATEGORIES } from '../../lib/budget/categories';
import type { Account, CategoryId, Transaction } from '../../lib/budget/types';
import {
  Card,
  CategoryDot,
  EmptyState,
  currentMonth,
  dateLabel,
  inputClass,
  monthLabel,
  shiftMonth,
  usd,
} from '../../components/ui';

export default function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | CategoryId>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [txnRes, accountRes] = await Promise.all([
      fetch(`/api/budget/transactions?month=${month}`),
      fetch('/api/budget/accounts'),
    ]);
    if (txnRes.ok) setTxns((await txnRes.json()).transactions);
    if (accountRes.ok) setAccounts((await accountRes.json()).accounts);
    setLoading(false);
  }, [month]);

  useAsyncEffect(load);

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.mask ? `${a.name} ••${a.mask}` : a.name]));
    return (id: string) => map.get(id) ?? '';
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((t) => {
      if (!showHidden && t.hidden) return false;
      if (category !== 'all' && t.category !== category) return false;
      if (q && !`${t.name} ${t.merchant ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txns, search, category, showHidden]);

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = byDate.get(t.date) ?? [];
      list.push(t);
      byDate.set(t.date, list);
    }
    return [...byDate.entries()];
  }, [filtered]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch('/api/budget/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      const { transaction } = await res.json();
      setTxns((prev) => prev.map((t) => (t.id === id ? transaction : t)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Activity</h1>
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchants"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | CategoryId)}
          className={inputClass}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
      </div>

      {loading ? (
        <div className="py-20 text-center text-ink-muted text-[14px]">Loading…</div>
      ) : groups.length === 0 ? (
        <EmptyState title="Nothing here">
          No transactions match for {monthLabel(month)}.
        </EmptyState>
      ) : (
        groups.map(([date, list]) => (
          <section key={date}>
            <h2 className="px-1 pb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              {dateLabel(date)}
            </h2>
            <Card className="divide-y divide-hairline">
              {list.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-[14px] ${t.hidden ? 'opacity-50' : ''}`}
                >
                  <CategoryDot category={t.category} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {t.merchant || t.name}
                      {t.pending ? (
                        <span className="ml-2 text-[11px] text-ink-muted uppercase">pending</span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-ink-muted truncate">{accountName(t.accountId)}</div>
                  </div>
                  <select
                    value={t.category}
                    onChange={(e) => patch(t.id, { category: e.target.value })}
                    className="rounded-md border border-[rgba(11,11,11,0.12)] bg-surface px-1.5 py-1 text-[12px] text-ink-secondary max-w-28"
                    aria-label={`Category for ${t.merchant || t.name}`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div
                    className={`w-24 text-right ${t.amount < 0 ? 'text-good-text font-medium' : ''}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {t.amount < 0 ? `+${usd(-t.amount)}` : usd(t.amount)}
                  </div>
                  <button
                    aria-label={t.hidden ? 'Unhide transaction' : 'Hide from budgets'}
                    title={t.hidden ? 'Unhide' : 'Hide from budgets'}
                    className="p-1 text-ink-muted hover:text-ink"
                    onClick={() => patch(t.id, { hidden: !t.hidden })}
                  >
                    {t.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
