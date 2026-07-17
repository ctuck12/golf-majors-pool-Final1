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

// ---- Move & payoff plan ----

export interface Debt {
  id: string;
  name: string;
  balance: number;
  payment?: number; // required monthly payment, if fixed
  apr?: number; // percent, e.g. 29.99
  payoffAtSale: boolean; // cleared with home-sale proceeds
  notes?: string;
}

export interface ExpectedInflow {
  id: string;
  name: string; // e.g. "IRS tax refund"
  amount: number;
  expectedDate?: string; // YYYY-MM-DD
  received: boolean;
  notes?: string;
}

export interface PlanPhase {
  id: string;
  label: string;
  income: number; // monthly take-home
  mortgage: number;
  recurringBills: number;
  giving: number;
  carPayment: number;
  savingsPct: number; // percent of income
  investPct: number; // percent of income
  notes?: string;
}

export interface VariableTarget {
  label: string;
  amount: number;
  note?: string;
}

export interface MovePlan {
  targetWindow: string; // free text, e.g. "Jan – Mar 2027"
  baseline: {
    income: number; // current monthly take-home
    recurringBills: number;
    variableSpending: number;
  };
  saleEquity: number; // expected net equity from home sale
  downPayment: number; // down payment on the new home
  inflows: ExpectedInflow[];
  debts: Debt[];
  phases: PlanPhase[];
  variableTargets: VariableTarget[];
  currentVariableRunRate: number; // for the required-reduction comparison
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  targetDate?: string; // YYYY-MM-DD
  createdAt: string; // ISO
}
