import { categoryFromPlaid } from './categories';
import { reconcileDebts } from './debts';
import {
  getAccounts as plaidGetAccounts,
  transactionsSync,
  type PlaidTransaction,
} from './plaid';
import { applyTransactionChanges, getItems, upsertAccounts, upsertItem } from './store';
import type { Account, Item, Transaction } from './types';

function toTransaction(t: PlaidTransaction): Transaction {
  return {
    id: t.transaction_id,
    accountId: t.account_id,
    date: t.authorized_date || t.date,
    name: t.name,
    merchant: t.merchant_name ?? undefined,
    amount: t.amount,
    category: categoryFromPlaid(
      t.personal_finance_category?.primary,
      t.personal_finance_category?.detailed,
    ),
    pending: t.pending,
  };
}

function toAccount(itemId: string, a: {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code: string | null };
}): Account {
  const type = ['depository', 'credit', 'loan', 'investment'].includes(a.type)
    ? (a.type as Account['type'])
    : 'other';
  return {
    id: a.account_id,
    itemId,
    name: a.name,
    officialName: a.official_name ?? undefined,
    mask: a.mask ?? undefined,
    type,
    subtype: a.subtype ?? undefined,
    balanceCurrent: a.balances.current ?? 0,
    balanceAvailable: a.balances.available ?? undefined,
    currency: a.balances.iso_currency_code ?? 'USD',
  };
}

export async function syncItem(item: Item): Promise<{ added: number; modified: number; removed: number }> {
  if (item.demo || !item.accessToken) return { added: 0, modified: 0, removed: 0 };

  // Refresh account list + balances.
  const accountsRes = await plaidGetAccounts(item.accessToken);
  await upsertAccounts(accountsRes.accounts.map((a) => toAccount(item.id, a)));

  // Pull transaction changes since the stored cursor.
  let cursor = item.cursor;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await transactionsSync(item.accessToken, cursor);
    await applyTransactionChanges({
      addedOrModified: [...page.added, ...page.modified].map(toTransaction),
      removedIds: page.removed.map((r) => r.transaction_id),
    });
    added += page.added.length;
    modified += page.modified.length;
    removed += page.removed.length;
    cursor = page.next_cursor;
    hasMore = page.has_more;
  }

  await upsertItem({ ...item, cursor, lastSyncedAt: new Date().toISOString() });
  // Keep move-plan debt balances in step with the new transactions/balances.
  await reconcileDebts().catch(() => {});
  return { added, modified, removed };
}

export async function syncAllItems() {
  const items = await getItems();
  const results: Record<string, { added: number; modified: number; removed: number } | { error: string }> = {};
  for (const item of items) {
    if (item.demo) continue;
    try {
      results[item.id] = await syncItem(item);
    } catch (err) {
      results[item.id] = { error: err instanceof Error ? err.message : 'sync failed' };
    }
  }
  return results;
}

export async function syncItemById(itemId: string) {
  const items = await getItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;
  return syncItem(item);
}
