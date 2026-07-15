import { redirect } from 'next/navigation';
import { isAuthEnabled, isAuthed } from '../lib/budget/auth';
import Nav from '../components/Nav';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authEnabled = isAuthEnabled();
  if (authEnabled && !(await isAuthed())) redirect('/login');

  return (
    <div className="min-h-svh">
      <Nav authEnabled={authEnabled} />
      <main className="mx-auto max-w-4xl px-4 pt-4 sm:pt-8 pb-24 sm:pb-16">{children}</main>
    </div>
  );
}
