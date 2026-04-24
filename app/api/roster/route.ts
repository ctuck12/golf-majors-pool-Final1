import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  saveRosterForUser,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
} from '../../lib/pool-store';

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to view a saved roster.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId || !isTournamentId(tournamentId)) {
    return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
  }

  return NextResponse.json({ roster: session.user.rosters[tournamentId] ?? [] });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to save a roster.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { tournamentId?: string; roster?: unknown };

    if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }

    const roster = await saveRosterForUser(session.user.id, body.tournamentId, body.roster);
    const refreshedSession = await getSessionContext(token);

    return NextResponse.json({
      roster,
      user: refreshedSession.user,
      pool: refreshedSession.pool,
      entries: refreshedSession.entries,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save roster.' },
      { status: 400 },
    );
  }
}
