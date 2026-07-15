'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { buttonPrimary, inputClass } from '../components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/budget/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Wrong passcode — try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-surface border border-[rgba(11,11,11,0.10)] p-6 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
          <Lock size={22} aria-hidden />
        </div>
        <h1 className="mt-3 text-[18px] font-semibold">Family Budget</h1>
        <p className="mt-1 text-[13px] text-ink-secondary">Enter the family passcode</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className={`${inputClass} mt-4 w-full text-center tracking-widest`}
          placeholder="Passcode"
        />
        {error ? <div className="mt-2 text-[13px] text-critical">{error}</div> : null}
        <button type="submit" className={`${buttonPrimary} mt-4 w-full justify-center`} disabled={busy || !passcode}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
