// Minimal Plaid REST client (only the endpoints this app needs).
// Configure with PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|production).

const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  production: 'https://production.plaid.com',
};

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidEnv(): string {
  return process.env.PLAID_ENV === 'production' ? 'production' : 'sandbox';
}

async function plaidPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const host = PLAID_HOSTS[plaidEnv()];
  const res = await fetch(`${host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error_message || data?.error_code || `Plaid ${path} failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: {
    current: number | null;
    available: number | null;
    iso_currency_code: string | null;
  };
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  date: string;
  authorized_date?: string | null;
  name: string;
  merchant_name?: string | null;
  amount: number;
  pending: boolean;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
}

export function createLinkToken(webhookUrl?: string) {
  return plaidPost<{ link_token: string }>('/link/token/create', {
    client_name: 'Family Budget',
    user: { client_user_id: 'family' },
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
    ...(webhookUrl ? { webhook: webhookUrl } : {}),
  });
}

export function exchangePublicToken(publicToken: string) {
  return plaidPost<{ access_token: string; item_id: string }>('/item/public_token/exchange', {
    public_token: publicToken,
  });
}

export function getAccounts(accessToken: string) {
  return plaidPost<{
    accounts: PlaidAccount[];
    item: { institution_name?: string | null };
  }>('/accounts/get', { access_token: accessToken });
}

export function transactionsSync(accessToken: string, cursor?: string) {
  return plaidPost<{
    added: PlaidTransaction[];
    modified: PlaidTransaction[];
    removed: { transaction_id: string }[];
    next_cursor: string;
    has_more: boolean;
  }>('/transactions/sync', {
    access_token: accessToken,
    ...(cursor ? { cursor } : {}),
    count: 500,
  });
}

export function removePlaidItem(accessToken: string) {
  return plaidPost<{ removed: boolean }>('/item/remove', { access_token: accessToken });
}
