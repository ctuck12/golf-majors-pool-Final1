'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { baselineNet, phaseMath, planMath } from '../../lib/budget/plan';
import type { Debt, ExpectedInflow, MovePlan } from '../../lib/budget/types';
import { Card, buttonPrimary, buttonSecondary, inputClass, usd } from '../../components/ui';
import { useAsyncEffect } from '../../components/useAsyncEffect';

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

function NumberField({
  value,
  onChange,
  className = 'w-28',
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <input
      inputMode="decimal"
      value={value === undefined ? '' : String(value)}
      onChange={(e) => {
        const v = e.target.value.trim();
        if (v === '') return onChange(undefined);
        const n = Number(v);
        if (Number.isFinite(n)) onChange(n);
      }}
      className={`rounded-lg border border-[rgba(11,11,11,0.15)] bg-surface px-2 py-1.5 text-[13px] text-right outline-none focus:border-accent ${className}`}
      aria-label={ariaLabel}
      placeholder="—"
    />
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {sub ? <p className="text-[12px] text-ink-secondary mt-0.5">{sub}</p> : null}
    </div>
  );
}

export default function PlanPage() {
  const [plan, setPlan] = useState<MovePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/budget/plan');
    if (res.ok) setPlan((await res.json()).plan);
  }, []);
  useAsyncEffect(load);

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    const res = await fetch('/api/budget/plan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (res.ok) {
      setPlan((await res.json()).plan);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const restoreDefaults = async () => {
    if (!confirm('Restore the plan to the spreadsheet numbers? Your edits will be lost.')) return;
    const res = await fetch('/api/budget/plan', { method: 'DELETE' });
    if (res.ok) setPlan((await res.json()).plan);
  };

  if (!plan) {
    return <div className="py-20 text-center text-ink-muted text-[14px]">Loading…</div>;
  }

  const math = planMath(plan);
  const net = baselineNet(plan);
  const targetsTotal = plan.variableTargets.reduce((s, t) => s + t.amount, 0);
  const phase1 = plan.phases[0];
  const phase1Allowance = phase1 ? phaseMath(phase1, plan.currentVariableRunRate).allowance : 0;

  const update = (patch: Partial<MovePlan>) => setPlan((p) => (p ? { ...p, ...patch } : p));
  const updateDebt = (id: string, patch: Partial<Debt>) =>
    update({ debts: plan.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const updateInflow = (id: string, patch: Partial<ExpectedInflow>) =>
    update({ inflows: plan.inflows.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold">Move & Payoff Plan</h1>
          <p className="text-[13px] text-ink-secondary mt-0.5">
            Selling, moving, and clearing debts — from the household budget spreadsheet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={buttonSecondary} onClick={restoreDefaults}>
            <RotateCcw size={14} aria-hidden /> Spreadsheet defaults
          </button>
          <button className={buttonPrimary} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save plan'}
          </button>
          {saved ? (
            <span className="flex items-center gap-1 text-[13px] text-good-text">
              <CheckCircle2 size={15} aria-hidden /> Saved
            </span>
          ) : null}
        </div>
      </div>

      {/* Today's baseline */}
      <section>
        <SectionTitle
          title="Today’s baseline"
          sub="Current monthly averages (Apr–Jun statements). The one-time April tax refund is excluded from income."
        />
        <Card className="p-4">
          <div className="grid sm:grid-cols-4 gap-4 text-[14px]">
            <div>
              <div className="text-[12px] text-ink-secondary mb-1">Take-home income</div>
              <NumberField
                value={plan.baseline.income}
                onChange={(n) => update({ baseline: { ...plan.baseline, income: n ?? 0 } })}
                ariaLabel="Monthly take-home income"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-[12px] text-ink-secondary mb-1">Recurring bills & loans</div>
              <NumberField
                value={plan.baseline.recurringBills}
                onChange={(n) => update({ baseline: { ...plan.baseline, recurringBills: n ?? 0 } })}
                ariaLabel="Monthly recurring bills"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-[12px] text-ink-secondary mb-1">Variable spending</div>
              <NumberField
                value={plan.baseline.variableSpending}
                onChange={(n) => update({ baseline: { ...plan.baseline, variableSpending: n ?? 0 } })}
                ariaLabel="Monthly variable spending"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-[12px] text-ink-secondary mb-1">Net monthly cash flow</div>
              <div
                className={`text-[20px] font-semibold ${net < 0 ? 'text-critical' : 'text-good-text'}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {net < 0 ? `−${usd(-net)}` : usd(net)}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Expected money */}
      <section>
        <SectionTitle
          title="Expected money"
          sub="One-time cash on the way — mark it received when it lands."
        />
        <Card className="divide-y divide-hairline">
          {plan.inflows.map((i) => (
            <div key={i.id} className="p-4 flex flex-wrap items-center gap-3">
              <input
                value={i.name}
                onChange={(e) => updateInflow(i.id, { name: e.target.value })}
                className={`${inputClass} flex-1 min-w-40`}
                aria-label="Inflow name"
              />
              <NumberField
                value={i.amount}
                onChange={(n) => updateInflow(i.id, { amount: n ?? 0 })}
                ariaLabel={`Amount for ${i.name}`}
              />
              <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={i.received}
                  onChange={(e) => updateInflow(i.id, { received: e.target.checked })}
                />
                Received
              </label>
              <span
                className={`text-[12px] px-2 py-0.5 rounded-full ${
                  i.received ? 'bg-good/15 text-good-text' : 'bg-warning/20 text-ink-secondary'
                }`}
              >
                {i.received ? 'received' : 'expected'}
              </span>
              <button
                aria-label={`Remove ${i.name}`}
                className="p-1 text-ink-muted hover:text-critical"
                onClick={() => update({ inflows: plan.inflows.filter((x) => x.id !== i.id) })}
              >
                <Trash2 size={15} />
              </button>
              {i.notes ? (
                <div className="w-full text-[12px] text-ink-muted">{i.notes}</div>
              ) : null}
            </div>
          ))}
          <div className="p-3">
            <button
              className={buttonSecondary}
              onClick={() =>
                update({
                  inflows: [
                    ...plan.inflows,
                    { id: crypto.randomUUID(), name: 'Expected money', amount: 0, received: false },
                  ],
                })
              }
            >
              <Plus size={14} aria-hidden /> Add expected money
            </button>
          </div>
        </Card>
      </section>

      {/* Debts */}
      <section>
        <SectionTitle
          title="Loans & debts"
          sub="Check “Pay off at sale” for balances the home-sale proceeds will clear."
        />
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-muted border-b border-hairline">
                <th className="px-4 py-2 font-medium">Debt</th>
                <th className="px-2 py-2 font-medium text-right">Balance</th>
                <th className="px-2 py-2 font-medium text-right">Payment/mo</th>
                <th className="px-2 py-2 font-medium text-right">APR %</th>
                <th className="px-2 py-2 font-medium text-center">Pay off at sale</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {plan.debts.map((d) => (
                <tr key={d.id} className="border-b border-hairline align-top">
                  <td className="px-4 py-2">
                    <input
                      value={d.name}
                      onChange={(e) => updateDebt(d.id, { name: e.target.value })}
                      className="w-full bg-transparent outline-none font-medium"
                      aria-label="Debt name"
                    />
                    {d.notes ? <div className="text-[11px] text-ink-muted mt-0.5">{d.notes}</div> : null}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <NumberField
                      value={d.balance}
                      onChange={(n) => updateDebt(d.id, { balance: n ?? 0 })}
                      ariaLabel={`Balance for ${d.name}`}
                      className="w-24"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <NumberField
                      value={d.payment}
                      onChange={(n) => updateDebt(d.id, { payment: n })}
                      ariaLabel={`Monthly payment for ${d.name}`}
                      className="w-20"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <NumberField
                      value={d.apr}
                      onChange={(n) => updateDebt(d.id, { apr: n })}
                      ariaLabel={`APR for ${d.name}`}
                      className="w-16"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={d.payoffAtSale}
                      onChange={(e) => updateDebt(d.id, { payoffAtSale: e.target.checked })}
                      aria-label={`Pay off ${d.name} at sale`}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      aria-label={`Remove ${d.name}`}
                      className="p-1 text-ink-muted hover:text-critical"
                      onClick={() => update({ debts: plan.debts.filter((x) => x.id !== d.id) })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <td className="px-4 py-2.5">Total</td>
                <td className="px-2 py-2.5 text-right">{usd(math.totalDebt)}</td>
                <td className="px-2 py-2.5 text-right">{usd(math.totalDebtPayments)}</td>
                <td />
                <td className="px-2 py-2.5 text-center text-[12px] text-ink-secondary">
                  {usd(math.payoffTotal)} flagged
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <div className="p-3 border-t border-hairline">
            <button
              className={buttonSecondary}
              onClick={() =>
                update({
                  debts: [...plan.debts, sanitizeDebtClient(crypto.randomUUID())],
                })
              }
            >
              <Plus size={14} aria-hidden /> Add debt
            </button>
          </div>
        </Card>
      </section>

      {/* Sale-day math */}
      <section>
        <SectionTitle
          title="Cash at closing"
          sub={`Target window: ${plan.targetWindow}`}
        />
        <Card className="p-4">
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[14px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-secondary">Expected net equity from home sale</span>
              <NumberField
                value={plan.saleEquity}
                onChange={(n) => update({ saleEquity: n ?? 0 })}
                ariaLabel="Expected net equity"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-secondary">Down payment on new home</span>
              <NumberField
                value={plan.downPayment}
                onChange={(n) => update({ downPayment: n ?? 0 })}
                ariaLabel="Down payment"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Equity left after down payment</span>
              <span className="font-medium">{usd(math.equityAfterDown)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Expected one-time money</span>
              <span className="font-medium">{usd(math.inflowTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Debts paid off at sale</span>
              <span className="font-medium text-critical">−{usd(math.payoffTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-secondary">Monthly payments freed up</span>
              <span className="font-medium text-good-text">{usd(math.freedMonthly)}/mo</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between">
            <div>
              <div className="text-[13px] text-ink-secondary">Cash remaining after payoffs</div>
              <div className="text-[12px] text-ink-muted">
                Emergency-fund seed — every $1,000 less down payment adds $1,000 here
              </div>
            </div>
            <div
              className={`text-[26px] font-semibold ${math.cashAfterPayoffs < 0 ? 'text-critical' : 'text-good-text'}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {usd(math.cashAfterPayoffs)}
            </div>
          </div>
          <div className="mt-3">
            <label className="text-[12px] text-ink-secondary mr-2">Target window</label>
            <input
              value={plan.targetWindow}
              onChange={(e) => update({ targetWindow: e.target.value })}
              className={`${inputClass} w-72 max-w-full`}
              aria-label="Target move window"
            />
          </div>
        </Card>
      </section>

      {/* Monthly plan by phase */}
      <section>
        <SectionTitle
          title="Monthly plan by phase"
          sub="After the move: 15% savings + 10% investments; what’s left is the variable-spending allowance."
        />
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[680px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="text-left text-[12px] text-ink-muted border-b border-hairline">
                <th className="px-4 py-2 font-medium w-52">&nbsp;</th>
                {plan.phases.map((p) => (
                  <th key={p.id} className="px-2 py-2 font-medium">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Take-home income', 'income'],
                  ['New mortgage', 'mortgage'],
                  ['Recurring bills after payoffs', 'recurringBills'],
                  ['Giving', 'giving'],
                  ['Car payment', 'carPayment'],
                  ['Savings (% of income)', 'savingsPct'],
                  ['Investments (% of income)', 'investPct'],
                ] as const
              ).map(([label, field]) => (
                <tr key={field} className="border-b border-hairline">
                  <td className="px-4 py-2 text-ink-secondary">{label}</td>
                  {plan.phases.map((p) => (
                    <td key={p.id} className="px-2 py-1.5">
                      <NumberField
                        value={p[field]}
                        onChange={(n) =>
                          update({
                            phases: plan.phases.map((x) =>
                              x.id === p.id ? { ...x, [field]: n ?? 0 } : x,
                            ),
                          })
                        }
                        ariaLabel={`${label} — ${p.label}`}
                        className="w-24"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {[
                {
                  label: 'Savings + investments ($)',
                  render: (m: ReturnType<typeof phaseMath>) => usd(m.savings + m.invest),
                  cls: '',
                },
                {
                  label: 'Variable allowance (what’s left)',
                  render: (m: ReturnType<typeof phaseMath>) => usd(m.allowance),
                  cls: 'font-semibold',
                },
                {
                  label: 'Mortgage as % of income',
                  render: (m: ReturnType<typeof phaseMath>) => pct(m.mortgagePct),
                  cls: '',
                },
                {
                  label: 'Required cut vs current run-rate',
                  render: (m: ReturnType<typeof phaseMath>) => `−${usd(m.requiredReduction)}/mo`,
                  cls: 'text-critical',
                },
              ].map((row) => (
                <tr key={row.label} className="border-b border-hairline">
                  <td className="px-4 py-2 text-ink-secondary">{row.label}</td>
                  {plan.phases.map((p) => (
                    <td key={p.id} className={`px-2 py-2 ${row.cls}`}>
                      {row.render(phaseMath(p, plan.currentVariableRunRate))}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2 text-ink-secondary">Current variable run-rate</td>
                <td className="px-2 py-1.5" colSpan={plan.phases.length}>
                  <NumberField
                    value={plan.currentVariableRunRate}
                    onChange={(n) => update({ currentVariableRunRate: n ?? 0 })}
                    ariaLabel="Current variable spending run-rate"
                    className="w-24"
                  />
                  <span className="ml-2 text-[12px] text-ink-muted">Apr–Jun average across all accounts</span>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        {plan.phases.some((p) => p.notes) ? (
          <ul className="mt-2 space-y-0.5 text-[12px] text-ink-muted list-disc pl-5">
            {plan.phases.filter((p) => p.notes).map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.label}:</span> {p.notes}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Variable targets */}
      <section>
        <SectionTitle
          title="Variable spending targets"
          sub="Tune these to fit the Phase 1 allowance — the make-or-break number."
        />
        <Card className="divide-y divide-hairline">
          {plan.variableTargets.map((t, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-2 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{t.label}</div>
                {t.note ? <div className="text-[11px] text-ink-muted">{t.note}</div> : null}
              </div>
              <NumberField
                value={t.amount}
                onChange={(n) =>
                  update({
                    variableTargets: plan.variableTargets.map((x, i) =>
                      i === idx ? { ...x, amount: n ?? 0 } : x,
                    ),
                  })
                }
                ariaLabel={`Target for ${t.label}`}
                className="w-24"
              />
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 text-[14px] font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <span>Targets total</span>
            <span className={targetsTotal > phase1Allowance ? 'text-critical' : 'text-good-text'}>
              {usd(targetsTotal)}{' '}
              <span className="font-normal text-ink-muted">
                vs {usd(phase1Allowance)} Phase 1 allowance
              </span>
            </span>
          </div>
        </Card>
      </section>

      <div className="flex items-center gap-3 pb-4">
        <button className={buttonPrimary} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save plan'}
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

function sanitizeDebtClient(id: string): Debt {
  return { id, name: 'New debt', balance: 0, payoffAtSale: false };
}
