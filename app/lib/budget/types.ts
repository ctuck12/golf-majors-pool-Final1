// Core data model for the family budget app.
//
// Money convention follows Plaid: transaction `amount` is positive for money
// leaving the account (spending) and negative for money coming in (income,
// refunds). Amounts are dollars as floats, matching what Plaid returns.

export type CategoryId =
  | 'income'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'bills'
  | 'home'
  | 'health'
  | 'personal'
  | 'kids'
  | 'travel'
  | 'transfer'
  | 'other';

export interface Item {
  id: string; // our internal id (Plaid item_id for real items, 'demo' for demo data)
  demo: boolean;
  accessToken?: string; // absent for demo items
  institutionName: string;
  cursor?: string; // Plaid transactions/sync cursor
  createdAt: string; // ISO
  lastSyncedAt?: string; // ISO
}

export interface Account {
  id: string; // Plaid account_id or demo id
  itemId: string;
  name: string;
  officialName?: string;
  mask?: string; // last 4 digits
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  balanceCurrent: number;
  balanceAvailable?: number;
  currency: string;
}

export interface Transaction {
  id: string; // Plaid transaction_id or demo id
  accountId: string;
  date: string; // YYYY-MM-DD
  name: string;
  merchant?: string;
  amount: number; // positive = money out, negative = money in
  category: CategoryId;
  categoryOverridden?: boolean; // user recategorized; sync must not clobber
  pending: boolean;
  hidden?: boolean; // excluded from budgets/reports
}

// Recurring monthly budget per category (dollars). Categories without an
// entry are unbudgeted.
export type Budgets = Partial<Record<CategoryId, number>>;

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  targetDate?: string; // YYYY-MM-DD
  createdAt: string; // ISO
}
