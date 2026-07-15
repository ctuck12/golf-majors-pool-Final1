'use client';

import { useCallback, useState } from 'react';
import { useAsyncEffect } from '../../components/useAsyncEffect';
import { CreditCard, Landmark, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import type { Account, Item } from '../../lib/budget/types';
import {
  Card,
  EmptyState,
  buttonSecondary,
  usd,
} from '../../components/ui';
import PlaidLinkButton from '../../components/PlaidLinkButton';

interface Config {
  plaidConfigured: boolean;
  plaidEnv: string;
  hasDemoData: boolean;
}

type ItemInfo = Omit<Item, 'accessToken'>;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<ItemInfo[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [accountRes, configRes] = await Promise.all([
      fetch('/api/budget/accounts'),
      fetch('/api/budget/config'),
    ]);
    if (accountRes.ok) {
      const data = await accountRes.json();
      setAccounts(data.accounts);
      setItems(data.items);
    }
    if (configRes.ok) setConfig(await configRes.json());
    setLoading(false);
  }, []);

  useAsyncEffect(load);

  const syncNow = async () => {
    setSyncing(true);
    setNotice(null);
    const res = await fetch('/api/budget/sync', { method: 'POST' });
    if (res.ok) {
      const { results } = await res.json();
      const counts = Object.values(results) as Array<
        { added?: number; error?: string }
      >;
      const errors = counts.filter((r) => r.error);
      const added = counts.reduce((s, r) => s + (r.added ?? 0), 0);
      setNotice(
        errors.length
          ? `Sync finished with errors: ${errors.map((e) => e.error).join('; ')}`
          : `Synced — ${added} new transaction${added === 1 ? '' : 's'}.`,
      );
    }
    await load();
    setSyncing(false);
  };

  const seedDemo = async () => {
    setBusy(true);
    await fetch('/api/budget/demo/seed', { method: 'POST' });
    await load();
    setBusy(false);
  };

  const resetDemo = async () => {
    if (!confirm('Remove the demo bank and all its data?')) return;
    setBusy(true);
    await fetch('/api/budget/demo/reset', { method: 'POST' });
    await load();
    setBusy(false);
  };

  const removeItem = async (item: ItemInfo) => {
    if (!confirm(`Disconnect ${item.institutionName}? Its accounts and transactions will be removed.`)) {
      return;
    }
    setBusy(true);
    await fetch(`/api/budget/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  };

  if (loading) {
    return <div className="py-20 text-center text-ink-muted text-[14px]">Loading…</div>;
  }

  const realItems = items.filter((i) => !i.demo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold">Accounts</h1>
        <div className="flex items-center gap-2">
          {realItems.length > 0 && (
            <button className={buttonSecondary} onClick={syncNow} disabled={syncing}>
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} aria-hidden />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          {config?.plaidConfigured && <PlaidLinkButton onLinked={load} />}
        </div>
      </div>

      {notice ? <div className="text-[13px] text-ink-secondary">{notice}</div> : null}

      {!config?.plaidConfigured && (
        <Card className="p-4 text-[13px] text-ink-secondary">
          <span className="font-semibold text-ink">Bank linking isn’t configured yet.</span> Add{' '}
          <code className="text-[12px]">PLAID_CLIENT_ID</code>,{' '}
          <code className="text-[12px]">PLAID_SECRET</code> and{' '}
          <code className="text-[12px]">PLAID_ENV</code> environment variables (see the README) to
          connect real banks and cards. Until then, demo data lets you use everything.
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState title="No accounts connected">
          Connect a bank above{config?.plaidConfigured ? '' : ' (once Plaid is configured)'} or
          seed demo data to explore.
        </EmptyState>
      ) : (
        items.map((item) => {
          const itemAccounts = accounts.filter((a) => a.itemId === item.id);
          return (
            <section key={item.id}>
              <div className="flex items-center justify-between px-1 pb-1">
                <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  {item.institutionName}
                  {item.demo ? ' (demo)' : ''}
                  {config?.plaidEnv === 'sandbox' && !item.demo ? ' (sandbox)' : ''}
                </h2>
                <button
                  aria-label={`Disconnect ${item.institutionName}`}
                  className="p-1 text-ink-muted hover:text-critical"
                  onClick={() => removeItem(item)}
                  disabled={busy}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <Card className="divide-y divide-hairline">
                {itemAccounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-hairline/60 text-ink-secondary">
                      {a.type === 'credit' ? (
                        <CreditCard size={17} aria-hidden />
                      ) : (
                        <Landmark size={17} aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {a.name}
                        {a.mask ? <span className="text-ink-muted"> ••{a.mask}</span> : null}
                      </div>
                      <div className="text-[12px] text-ink-muted capitalize">
                        {a.subtype || a.type}
                      </div>
                    </div>
                    <div
                      className={a.type === 'credit' && a.balanceCurrent > 0 ? 'text-critical' : ''}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {usd(a.balanceCurrent)}
                    </div>
                  </div>
                ))}
                {item.lastSyncedAt ? (
                  <div className="px-4 py-2 text-[12px] text-ink-muted">
                    Last synced {new Date(item.lastSyncedAt).toLocaleString()}
                  </div>
                ) : null}
              </Card>
            </section>
          );
        })
      )}

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Demo data</h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Seed a demo bank with three accounts and ~90 days of realistic family spending, or remove
          it when you connect real accounts.
        </p>
        <div className="mt-3 flex gap-2">
          <button className={buttonSecondary} onClick={seedDemo} disabled={busy}>
            <Sparkles size={15} aria-hidden /> {config?.hasDemoData ? 'Reseed demo data' : 'Seed demo data'}
          </button>
          {config?.hasDemoData && (
            <button className={buttonSecondary} onClick={resetDemo} disabled={busy}>
              <Trash2 size={15} aria-hidden /> Remove demo data
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
