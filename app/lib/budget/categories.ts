import type { CategoryId } from './types';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  // Identity dot color. Labels always accompany the dot, so minor categories
  // sharing the muted gray is fine — text carries identity.
  color: string;
  spending: boolean; // counts toward "spent" totals and budgets
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'groceries', label: 'Groceries', color: '#1baf7a', spending: true },
  { id: 'dining', label: 'Dining & Drinks', color: '#eb6834', spending: true },
  { id: 'transport', label: 'Transport & Gas', color: '#2a78d6', spending: true },
  { id: 'shopping', label: 'Shopping', color: '#e87ba4', spending: true },
  { id: 'entertainment', label: 'Entertainment', color: '#4a3aa7', spending: true },
  { id: 'bills', label: 'Bills & Utilities', color: '#eda100', spending: true },
  { id: 'home', label: 'Home', color: '#898781', spending: true },
  { id: 'health', label: 'Health', color: '#e34948', spending: true },
  { id: 'personal', label: 'Personal Care', color: '#898781', spending: true },
  { id: 'kids', label: 'Kids & Family', color: '#898781', spending: true },
  { id: 'travel', label: 'Travel', color: '#898781', spending: true },
  { id: 'other', label: 'Other', color: '#898781', spending: true },
  { id: 'income', label: 'Income', color: '#008300', spending: false },
  { id: 'transfer', label: 'Transfers', color: '#898781', spending: false },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryDef>;

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && value in CATEGORY_MAP;
}

// Map Plaid personal_finance_category → our categories.
export function categoryFromPlaid(primary?: string, detailed?: string): CategoryId {
  if (detailed === 'FOOD_AND_DRINK_GROCERIES') return 'groceries';
  switch (primary) {
    case 'INCOME':
      return 'income';
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return 'transfer';
    case 'FOOD_AND_DRINK':
      return 'dining';
    case 'TRANSPORTATION':
      return 'transport';
    case 'GENERAL_MERCHANDISE':
      return 'shopping';
    case 'ENTERTAINMENT':
      return 'entertainment';
    case 'RENT_AND_UTILITIES':
    case 'LOAN_PAYMENTS':
    case 'BANK_FEES':
      return 'bills';
    case 'HOME_IMPROVEMENT':
      return 'home';
    case 'MEDICAL':
      return 'health';
    case 'PERSONAL_CARE':
      return 'personal';
    case 'TRAVEL':
      return 'travel';
    default:
      return 'other';
  }
}
