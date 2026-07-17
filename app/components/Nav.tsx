'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, List, PieChart, Target, Map, Landmark, LogOut } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/transactions', label: 'Activity', icon: List },
  { href: '/budgets', label: 'Budgets', icon: PieChart },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/plan', label: 'Plan', icon: Map },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
];

export default function Nav({ authEnabled }: { authEnabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/budget/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden sm:block sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-hairline">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[15px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white text-[15px] font-bold">
              $
            </span>
            Family Budget
          </Link>
          <nav className="flex items-center gap-1 text-[14px]">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    active
                      ? 'bg-hairline/60 font-semibold text-ink'
                      : 'text-ink-secondary hover:text-ink'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          {authEnabled && (
            <button
              onClick={logout}
              className="ml-auto flex items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink"
            >
              <LogOut size={15} aria-hidden /> Lock
            </button>
          )}
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-hairline pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  active ? 'text-accent-deep font-semibold' : 'text-ink-muted'
                }`}
              >
                <Icon size={20} aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
