import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, listPoolMembers, registerUser, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

const COMMISSIONER_EMAIL = 'ctuck12@gmail.com';
const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool members.' }, { status: 401 });
  }

  if (
    session.user.email.trim().toLowerCase() !== COMMISSIONER_EMAIL ||
    session.user.displayName.trim() !== COMMISSIONER_DISPLAY_NAME
  ) {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const members = await listPoolMembers(session.user.id);
    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load pool members.' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool members.' }, { status: 401 });
  }

  if (
    session.user.email.trim().toLowerCase() !== COMMISSIONER_EMAIL ||
    session.user.displayName.trim() !== COMMISSIONER_DISPLAY_NAME
  ) {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      displayName?: string;
      email?: string;
      password?: string;
    };

    const member = await registerUser({
      displayName: body.displayName ?? '',
      email: body.email ?? '',
      password: body.password ?? '',
    });

    return NextResponse.json({ member });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to add pool member.' },
      { status: 400 },
    );
  }
}
