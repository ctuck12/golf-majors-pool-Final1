import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { removeSession, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await removeSession(token);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
