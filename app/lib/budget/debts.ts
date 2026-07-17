// Debt auto-tracking. Two mechanisms, both optional per debt, and manual
// edits always win (editing a balance resets the tracking baseline):
//
// 1. matchPatterns — loan payments are matched by name against synced
//    transactions and subtracted from the balance. Guards: only posted
//    (non-pending) outflows dated after `balanceAsOf`; each transaction is
//    applied once (appliedTxnIds); when the debt has a known monthly
//    payment, only amounts >= half of it count, so a $15 lunch at a
//    merchant with a similar name can't dent a loan.
// 2. linkedAccountId — the balance mirrors the linked account's live
//    balance from Plaid. Right for credit cards, where purchases and
//    interest move the balance up as payments move it down.
//
// Demo-bank transactions never touch debt balances.
import { getAccounts, getItems, getPlan, getTransactions, savePlan } from './store';
import type { Debt, Transaction } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

function txnMatches(t: Transaction, patterns: string[], minAmount: number): boolean {
  if (t.pending || t.amount <= 0 || t.amount < minAmount) return false;
  const hay = `${t.name} ${t.merchant ?? ''}`.toLowerCase();
  return patterns.some((p) => hay.includes(p.toLowerCase()));
}

export async function reconcileDebts(): Promise<{ paymentsApplied: number; mirrored: number }> {
  const [plan, txns, accounts, items] = await Promise.all([
    getPlan(),
    getTransactions(),
    getAccounts(),
    getItems(),
  ]);

  const demoAccountIds = new Set(
    accounts
      .filter((a) => items.some((i) => i.demo && i.id === a.itemId))
      .map((a) => a.id),
  );
  const realTxns = txns.filter((t) => !demoAccountIds.has(t.accountId));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  let changed = false;
  let paymentsApplied = 0;
  let mirrored = 0;

  for (const debt of plan.debts) {
    // Mirror mode: balance follows the linked account.
    if (debt.linkedAccountId) {
      const account = accountById.get(debt.linkedAccountId);
      if (account && !demoAccountIds.has(account.id)) {
        const live = round2(Math.max(0, account.balanceCurrent));
        if (live !== debt.balance) {
          debt.balance = live;
          changed = true;
          mirrored++;
        }
      }
      continue;
    }

    // Pattern mode: subtract matching payments made after the baseline date.
    const patterns = debt.matchPatterns ?? [];
    if (patterns.length === 0) continue;
    const applied = new Set(debt.appliedTxnIds ?? []);
    const minAmount = debt.payment ? debt.payment * 0.5 : 0.01;
    const matches = realTxns
      .filter(
        (t) =>
          !applied.has(t.id) &&
          (!debt.balanceAsOf || t.date > debt.balanceAsOf) &&
          txnMatches(t, patterns, minAmount),
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    for (const t of matches) {
      debt.balance = round2(Math.max(0, debt.balance - t.amount));
      applied.add(t.id);
      debt.balanceAsOf =
        !debt.balanceAsOf || t.date > debt.balanceAsOf ? t.date : debt.balanceAsOf;
      paymentsApplied++;
      changed = true;
    }
    if (changed) debt.appliedTxnIds = [...applied];
  }

  if (changed) await savePlan(plan);
  return { paymentsApplied, mirrored };
}

// Called by the plan PUT route: carries tracking state across a manual
// save, and resets the baseline for any debt whose balance was hand-edited
// so auto-tracking continues from the user's number.
export function mergeManualDebtEdits(previous: Debt[], incoming: Debt[], today: string): Debt[] {
  const prevById = new Map(previous.map((d) => [d.id, d]));
  return incoming.map((d) => {
    const prev = prevById.get(d.id);
    if (!prev) {
      return { ...d, balanceAsOf: d.balanceAsOf ?? today, appliedTxnIds: [] };
    }
    if (prev.balance !== d.balance) {
      // Manual balance edit: new baseline, forget applied history.
      return { ...d, balanceAsOf: today, appliedTxnIds: [] };
    }
    // Balance untouched: server-side tracking state is authoritative.
    return { ...d, balanceAsOf: prev.balanceAsOf, appliedTxnIds: prev.appliedTxnIds };
  });
}
