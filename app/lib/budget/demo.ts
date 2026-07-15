// Demo mode: seeds realistic family accounts, ~90 days of transactions,
// starter budgets, and a couple of goals — so the app is fully clickable
// before any bank is connected. Deterministic RNG keeps reseeds stable.
import {
  getBudgets,
  getGoals,
  saveBudgets,
  saveGoals,
  saveAccounts,
  saveTransactions,
  upsertItem,
  getAccounts,
  getTransactions,
} from './store';
import type { Account, CategoryId, Goal, Item, Transaction } from './types';

export const DEMO_ITEM_ID = 'demo';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS: Partial<Record<CategoryId, { name: string; min: number; max: number }[]>> = {
  groceries: [
    { name: 'Kroger', min: 38, max: 160 },
    { name: 'Publix', min: 25, max: 130 },
    { name: 'Costco', min: 90, max: 260 },
    { name: 'Trader Joe’s', min: 22, max: 85 },
  ],
  dining: [
    { name: 'Chick-fil-A', min: 9, max: 42 },
    { name: 'Chipotle', min: 11, max: 38 },
    { name: 'Starbucks', min: 5, max: 16 },
    { name: 'Local Pizza Co', min: 24, max: 58 },
    { name: 'Sushi House', min: 40, max: 110 },
  ],
  transport: [
    { name: 'Shell', min: 28, max: 62 },
    { name: 'QuikTrip', min: 25, max: 58 },
    { name: 'Uber', min: 9, max: 34 },
  ],
  shopping: [
    { name: 'Amazon', min: 12, max: 120 },
    { name: 'Target', min: 18, max: 140 },
    { name: 'Home Depot', min: 15, max: 180 },
  ],
  entertainment: [
    { name: 'AMC Theatres', min: 24, max: 64 },
    { name: 'Topgolf', min: 45, max: 120 },
    { name: 'Steam', min: 10, max: 60 },
  ],
  health: [
    { name: 'CVS Pharmacy', min: 8, max: 55 },
    { name: 'Family Dental', min: 40, max: 180 },
  ],
  kids: [
    { name: 'Soccer Club Dues', min: 25, max: 95 },
    { name: 'Scholastic Books', min: 9, max: 30 },
  ],
  personal: [
    { name: 'Great Clips', min: 18, max: 45 },
    { name: 'Sephora', min: 20, max: 85 },
  ],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function seedDemoData() {
  const rand = mulberry32(20260715);
  const today = new Date();

  const item: Item = {
    id: DEMO_ITEM_ID,
    demo: true,
    institutionName: 'Demo Bank',
    createdAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };

  const checking: Account = {
    id: 'demo-checking',
    itemId: DEMO_ITEM_ID,
    name: 'Family Checking',
    mask: '4321',
    type: 'depository',
    subtype: 'checking',
    balanceCurrent: 0,
    currency: 'USD',
  };
  const savings: Account = {
    id: 'demo-savings',
    itemId: DEMO_ITEM_ID,
    name: 'Family Savings',
    mask: '8890',
    type: 'depository',
    subtype: 'savings',
    balanceCurrent: 18450.22,
    currency: 'USD',
  };
  const card: Account = {
    id: 'demo-card',
    itemId: DEMO_ITEM_ID,
    name: 'Rewards Credit Card',
    mask: '0071',
    type: 'credit',
    subtype: 'credit card',
    balanceCurrent: 0,
    currency: 'USD',
  };

  const txns: Transaction[] = [];
  let txnSeq = 0;
  const push = (
    accountId: string,
    date: Date,
    name: string,
    amount: number,
    category: CategoryId,
  ) => {
    txns.push({
      id: `demo-txn-${txnSeq++}`,
      accountId,
      date: iso(date),
      name,
      merchant: name,
      amount: round2(amount),
      category,
      pending: false,
    });
  };

  const start = new Date(today);
  start.setDate(start.getDate() - 92);

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const dom = day.getDate();
    const dow = day.getDay();

    // Payroll: two salaries. Income is negative (money in).
    if (dom === 1 || dom === 15) push(checking.id, day, 'Acme Corp Payroll', -3120, 'income');
    if (dom === 5 || dom === 20) push(checking.id, day, 'Northside Schools Payroll', -1875, 'income');

    // Fixed monthly bills from checking.
    if (dom === 1) push(checking.id, day, 'Mortgage Payment', 2150, 'bills');
    if (dom === 3) push(checking.id, day, 'Georgia Power', 130 + rand() * 90, 'bills');
    if (dom === 7) push(checking.id, day, 'City Water & Sewer', 55 + rand() * 30, 'bills');
    if (dom === 10) push(checking.id, day, 'Verizon Wireless', 142.6, 'bills');
    if (dom === 12) push(checking.id, day, 'State Farm Insurance', 218.4, 'bills');
    if (dom === 16) push(card.id, day, 'Netflix', 15.49, 'entertainment');
    if (dom === 18) push(card.id, day, 'Spotify Family', 16.99, 'entertainment');
    if (dom === 22) push(checking.id, day, 'YMCA Membership', 89, 'health');
    if (dom === 25) push(checking.id, day, 'Transfer to Savings', 500, 'transfer');
    if (dom === 25) push(savings.id, day, 'Transfer from Checking', -500, 'transfer');

    const spendFrom = (category: CategoryId, probability: number, account = card.id) => {
      const options = MERCHANTS[category];
      if (!options || rand() > probability) return;
      const m = options[Math.floor(rand() * options.length)];
      push(account, day, m.name, m.min + rand() * (m.max - m.min), category);
    };

    spendFrom('groceries', dow === 0 || dow === 3 ? 0.9 : 0.08);
    spendFrom('dining', dow === 5 || dow === 6 ? 0.75 : 0.3);
    spendFrom('transport', dow === 1 || dow === 4 ? 0.55 : 0.1);
    spendFrom('shopping', 0.22);
    spendFrom('entertainment', dow === 6 ? 0.35 : 0.05);
    spendFrom('health', 0.06);
    spendFrom('kids', 0.09);
    spendFrom('personal', 0.07);
  }

  // Card payment each month on the 28th (transfer, not spending).
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    if (d.getDate() === 28) {
      push(checking.id, new Date(d), 'Credit Card Payment', 1900 + rand() * 600, 'transfer');
      push(card.id, new Date(d), 'Payment Received — Thank You', -(1900 + rand() * 600), 'transfer');
    }
  }

  txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Derive plausible balances from recent card activity.
  const cardBalance = txns
    .filter((t) => t.accountId === card.id && t.date >= iso(new Date(today.getFullYear(), today.getMonth(), 1)))
    .reduce((sum, t) => sum + t.amount, 0);
  card.balanceCurrent = round2(Math.max(cardBalance, 0));
  checking.balanceCurrent = 6231.77;
  checking.balanceAvailable = 6231.77;

  await upsertItem(item);
  // Replace any prior demo accounts/transactions wholesale, keep real ones.
  const [accounts, existingTxns] = await Promise.all([getAccounts(), getTransactions()]);
  await saveAccounts([
    ...accounts.filter((a) => a.itemId !== DEMO_ITEM_ID),
    checking,
    savings,
    card,
  ]);
  await saveTransactions([
    ...existingTxns.filter((t) => !t.id.startsWith('demo-txn-')),
    ...txns,
  ]);

  // Starter budgets and goals, only if none exist yet.
  const budgets = await getBudgets();
  if (Object.keys(budgets).length === 0) {
    await saveBudgets({
      groceries: 900,
      dining: 450,
      transport: 320,
      shopping: 400,
      entertainment: 150,
      bills: 2900,
      health: 200,
      kids: 150,
      personal: 100,
    });
  }
  const goals = await getGoals();
  if (goals.length === 0) {
    const newGoals: Goal[] = [
      {
        id: 'demo-goal-emergency',
        name: 'Emergency Fund',
        target: 25000,
        saved: 18450,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-goal-vacation',
        name: 'Summer Vacation',
        target: 6000,
        saved: 2350,
        targetDate: iso(new Date(today.getFullYear() + 1, 5, 1)),
        createdAt: new Date().toISOString(),
      },
    ];
    await saveGoals(newGoals);
  }

  return { transactions: txns.length, accounts: 3 };
}
