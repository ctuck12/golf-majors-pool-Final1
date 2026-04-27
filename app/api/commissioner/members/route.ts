import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, listPoolMembers, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool members.' }, { status: 401 });
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
