'use client';

import { AlertTriangle } from 'lucide-react';
import { CATEGORY_MAP } from '../lib/budget/categories';
import type { CategoryId } from '../lib/budget/types';

export const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export const usdWhole = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-surface border border-[rgba(11,11,11,0.10)] shadow-[0_1px_2px_rgba(11,11,11,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, tone }: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'critical';
}) {
  const valueColor =
    tone === 'good' ? 'text-good-text' : tone === 'critical' ? 'text-critical' : 'text-ink';
  return (
    <Card className="p-4">
      <div className="text-[13px] text-ink-secondary">{label}</div>
      <div className={`mt-1 text-[26px] leading-8 font-semibold ${valueColor}`}>{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-ink-muted">{sub}</div> : null}
    </Card>
  );
}

export function CategoryDot({ category }: { category: CategoryId }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ background: CATEGORY_MAP[category]?.color ?? '#898781' }}
      aria-hidden
    />
  );
}

// Budget meter: thin track, rounded data end, status color only when the
// state is real (over / nearly over), always paired with a text label.
export function BudgetMeter({ spent, budget }: { spent: number; budget: number }) {
  const ratio = budget > 0 ? spent / budget : 0;
  const over = ratio > 1;
  const near = !over && ratio >= 0.9;
  const fill = over ? 'var(--color-critical)' : 'var(--color-accent)';
  return (
    <div>
      <div className="h-2 rounded-full bg-hairline overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, background: fill }}
        />
      </div>
      {(over || near) && (
        <div
          className={`mt-1 flex items-center gap-1 text-[12px] ${over ? 'text-critical' : 'text-ink-secondary'}`}
        >
          <AlertTriangle size={12} aria-hidden />
          {over ? `Over by ${usd(spent - budget)}` : `${usd(budget - spent)} left`}
        </div>
      )}
    </div>
  );
}

export function ProgressBar({ ratio, color = 'var(--color-accent)' }: { ratio: number; color?: string }) {
  return (
    <div className="h-2 rounded-full bg-hairline overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(ratio, 1)) * 100}%`, background: color }}
      />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <div className="text-[15px] font-semibold">{title}</div>
      {children ? <div className="mt-2 text-[13px] text-ink-secondary">{children}</div> : null}
    </Card>
  );
}

export const buttonPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-accent-deep text-white text-[14px] font-medium px-4 py-2 hover:bg-accent transition-colors disabled:opacity-50';
export const buttonSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-[rgba(11,11,11,0.15)] bg-surface text-ink text-[14px] font-medium px-4 py-2 hover:bg-hairline/40 transition-colors disabled:opacity-50';
export const inputClass =
  'rounded-lg border border-[rgba(11,11,11,0.15)] bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent';
