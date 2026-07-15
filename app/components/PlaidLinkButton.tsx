'use client';

import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { buttonPrimary } from './ui';

declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        onSuccess: (publicToken: string, metadata: { institution?: { name?: string } }) => void;
        onExit?: () => void;
      }): { open(): void };
    };
  }
}

const PLAID_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

function loadPlaidScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const existing = document.querySelector(`script[src="${PLAID_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Plaid script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = PLAID_SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Plaid script failed to load'));
    document.head.appendChild(script);
  });
}

export default function PlaidLinkButton({
  onLinked,
  label = 'Connect a bank',
}: {
  onLinked: () => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLink = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadPlaidScript();
      const res = await fetch('/api/budget/plaid/link-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start Plaid Link');
      const handler = window.Plaid!.create({
        token: data.linkToken,
        onSuccess: async (publicToken, metadata) => {
          const exchange = await fetch('/api/budget/plaid/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publicToken,
              institutionName: metadata.institution?.name,
            }),
          });
          const result = await exchange.json();
          if (!exchange.ok) {
            setError(result.error || 'Linking failed');
          } else {
            onLinked();
          }
          setBusy(false);
        },
        onExit: () => setBusy(false),
      });
      handler.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div>
      <button className={buttonPrimary} onClick={openLink} disabled={busy}>
        <Landmark size={16} aria-hidden />
        {busy ? 'Opening…' : label}
      </button>
      {error ? <div className="mt-2 text-[13px] text-critical">{error}</div> : null}
    </div>
  );
}
