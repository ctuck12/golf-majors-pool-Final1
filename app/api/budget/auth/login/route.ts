import { cookies } from 'next/headers';
import {
  AUTH_COOKIE,
  isAuthEnabled,
  passcodeMatches,
  sessionToken,
} from '../../../../lib/budget/auth';

export async function POST(request: Request) {
  if (!isAuthEnabled()) return Response.json({ ok: true });
  const body = await request.json().catch(() => ({}));
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';
  if (!passcodeMatches(passcode)) {
    return Response.json({ error: 'Wrong passcode' }, { status: 401 });
  }
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 180,
    path: '/',
  });
  return Response.json({ ok: true });
}
