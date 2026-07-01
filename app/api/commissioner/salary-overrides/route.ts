import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import {
  parseSalaryPaste,
  getManualSalaries,
  saveManualSalaries,
  clearManualSalaries,
} from '../../../lib/salary-overrides-store';

export const dynamic = 'force-dynamic';

const COMMISSIONER_EMAIL = 'ctuck12@gmail.com';
const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';

async function requireCommissioner() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (!session.user) return { error: NextResponse.json({ error: 'Sign in to manage pool settings.' }, { status: 401 }) };
  if (
    session.user.email.trim().toLowerCase() !== COMMISSIONER_EMAIL ||
    session.user.displayName.trim() !== COMMISSIONER_DISPLAY_NAME
  ) {
    return { error: NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const current = await getManualSalaries();
  return NextResponse.json({ active: !!current, count: current?.count ?? 0, updatedAt: current?.updatedAt ?? null });
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string };
  try { body = (await request.json()) as { text?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the salary list first.' }, { status: 400 });

  const parsed = parseSalaryPaste(text);
  if (parsed.matched.length < 5) {
    return NextResponse.json({
      error: `Only ${parsed.matched.length} player(s) matched the pool — that doesn't look right. Each line should be "Player Name  Salary", e.g. "Scottie Scheffler 11900".`,
      unmatched: parsed.unmatched.slice(0, 15),
      skipped: parsed.skipped.slice(0, 10),
    }, { status: 400 });
  }
  const saved = await saveManualSalaries(parsed.map, new Date().toISOString());
  return NextResponse.json({
    ok: true,
    count: saved.count,
    updatedAt: saved.updatedAt,
    matchedCount: parsed.matched.length,
    unmatchedCount: parsed.unmatched.length,
    unmatched: parsed.unmatched.slice(0, 25), // surface names that didn't map so the commissioner can fix spelling
    skipped: parsed.skipped.slice(0, 10),
    preview: parsed.matched.slice().sort((a, b) => b.salary - a.salary).slice(0, 15),
  });
}

export async function DELETE() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  await clearManualSalaries();
  return NextResponse.json({ ok: true, active: false });
}
