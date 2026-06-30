export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

// Lists the PGA Tour winning events behind our career-wins sum, for a given playerId
// (default Matt Fitzpatrick 40098). ?id=NNN to check another player.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '40098';
  const q = `query R($id: ID!){
    playerProfileTournamentResults(playerId: $id, tourCode: R){
      tournaments { tournamentOverview { tournamentName displaySeason } overviewInfo { events wins money } }
    }
  }`;
  const r = await gql(q, { id }) as {
    data?: { playerProfileTournamentResults?: { tournaments?: Array<{ tournamentOverview?: { tournamentName?: string; displaySeason?: string }; overviewInfo?: { events?: number; wins?: number; money?: number } }> } };
    errors?: Array<{ message?: string }>;
  };
  if (r?.errors?.length) return Response.json({ error: r.errors[0]?.message });
  const groups = r?.data?.playerProfileTournamentResults?.tournaments ?? [];
  let totalEvents = 0, totalWins = 0;
  const winningEvents: Array<{ tournament: string; season: string; wins: number; events: number }> = [];
  for (const g of groups) {
    const w = g.overviewInfo?.wins ?? 0;
    totalEvents += g.overviewInfo?.events ?? 0;
    totalWins += w;
    if (w > 0) winningEvents.push({
      tournament: g.tournamentOverview?.tournamentName ?? '(unknown)',
      season: g.tournamentOverview?.displaySeason ?? '',
      wins: w,
      events: g.overviewInfo?.events ?? 0,
    });
  }
  return Response.json({ id, totalEvents, totalWins, distinctWinningEventsCount: winningEvents.length, winningEvents });
}
