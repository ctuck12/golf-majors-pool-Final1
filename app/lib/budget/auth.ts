// Family passcode gate. When FAMILY_PASSCODE is unset the app is open
// (useful while trying the demo); once set, every page and API route
// requires the passcode once per browser (long-lived HttpOnly cookie).
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'budget_auth';
const TOKEN_CONTEXT = 'family-budget-auth-v1';

export function isAuthEnabled(): boolean {
  return Boolean(process.env.FAMILY_PASSCODE);
}

export function sessionToken(): string {
  return createHmac('sha256', process.env.FAMILY_PASSCODE ?? '')
    .update(TOKEN_CONTEXT)
    .digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function passcodeMatches(passcode: string): boolean {
  return safeEqual(passcode, process.env.FAMILY_PASSCODE ?? '');
}

export async function isAuthed(): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return Boolean(token && safeEqual(token, sessionToken()));
}

// For route handlers: returns a 401 response to send, or null if OK.
export async function requireAuth(): Promise<Response | null> {
  if (await isAuthed()) return null;
  return Response.json({ error: 'Not authorized' }, { status: 401 });
}
