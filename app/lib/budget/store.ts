// Persistence for the budget app. Uses the project's existing Redis
// (REDIS_URL) under a `budget:` key namespace, with an in-process memory
// fallback so local dev and builds work without Redis. Family-scale data
// (a few thousand transactions) fits comfortably in single JSON documents.
import redis from '../redis';
import { DEFAULT_PLAN } from './plan';
import type { Account, Budgets, Goal, Item, MovePlan, Transaction } from './types';

const hasRedis = Boolean(process.env.REDIS_URL);
const memory = new Map<string, string>();

async function kvGet(key: string): Promise<string | null> {
  if (!hasRedis) return memory.get(key) ?? null;
  return redis.get(key);
}

async function kvSet(key: string, value: string): Promise<void> {
  if (!hasRedis) {
    memory.set(key, value);
    return;
  }
  await redis.set(key, value);
}

async function kvDel(...keys: string[]): Promise<void> {
  if (!hasRedis) {
    keys.forEach((k) => memory.delete(k));
    return;
  }
  await redis.del(...keys);
}

const KEYS = {
  items: 'budget:items',
  accounts: 'budget:accounts',
  transactions: 'budget:transactions',
  budgets: 'budget:budgets',
  goals: 'budget:goals',
  plan: 'budget:plan',
};

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await kvGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const getItems = () => readJSON<Item[]>(KEYS.items, []);
export const saveItems = (items: Item[]) => kvSet(KEYS.items, JSON.stringify(items));

export const getAccounts = () => readJSON<Account[]>(KEYS.accounts, []);
export const saveAccounts = (accounts: Account[]) =>
  kvSet(KEYS.accounts, JSON.stringify(accounts));

export const getTransactions = () => readJSON<Transaction[]>(KEYS.transactions, []);
export const saveTransactions = (txns: Transaction[]) =>
  kvSet(KEYS.transactions, JSON.stringify(txns));

export const getBudgets = () => readJSON<Budgets>(KEYS.budgets, {});
export const saveBudgets = (budgets: Budgets) => kvSet(KEYS.budgets, JSON.stringify(budgets));

export const getGoals = () => readJSON<Goal[]>(KEYS.goals, []);
export const saveGoals = (goals: Goal[]) => kvSet(KEYS.goals, JSON.stringify(goals));

export const getPlan = () => readJSON<MovePlan>(KEYS.plan, DEFAULT_PLAN);
export const savePlan = (plan: MovePlan) => kvSet(KEYS.plan, JSON.stringify(plan));
export const resetPlan = () => kvDel(KEYS.plan);

export async function upsertItem(item: Item) {
  const items = await getItems();
  const next = items.filter((i) => i.id !== item.id);
  next.push(item);
  await saveItems(next);
}

export async function upsertAccounts(accounts: Account[]) {
  const existing = await getAccounts();
  const incoming = new Map(accounts.map((a) => [a.id, a]));
  const next = existing.map((a) => incoming.get(a.id) ?? a);
  const known = new Set(existing.map((a) => a.id));
  for (const a of accounts) if (!known.has(a.id)) next.push(a);
  await saveAccounts(next);
}

// Merge synced transactions. Preserves user recategorization and hidden
// flags when Plaid re-sends a modified transaction.
export async function applyTransactionChanges(changes: {
  addedOrModified: Transaction[];
  removedIds: string[];
}) {
  const existing = await getTransactions();
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const t of changes.addedOrModified) {
    const prev = byId.get(t.id);
    if (prev?.categoryOverridden) {
      byId.set(t.id, { ...t, category: prev.category, categoryOverridden: true, hidden: prev.hidden });
    } else {
      byId.set(t.id, { ...t, hidden: prev?.hidden });
    }
  }
  for (const id of changes.removedIds) byId.delete(id);
  const next = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  await saveTransactions(next);
}

// Remove an item and everything that came from it.
export async function removeItemData(itemId: string) {
  const [items, accounts, txns] = await Promise.all([getItems(), getAccounts(), getTransactions()]);
  const removedAccountIds = new Set(accounts.filter((a) => a.itemId === itemId).map((a) => a.id));
  await Promise.all([
    saveItems(items.filter((i) => i.id !== itemId)),
    saveAccounts(accounts.filter((a) => a.itemId !== itemId)),
    saveTransactions(txns.filter((t) => !removedAccountIds.has(t.accountId))),
  ]);
}

export async function resetAllData() {
  await kvDel(KEYS.items, KEYS.accounts, KEYS.transactions, KEYS.budgets, KEYS.goals);
}
