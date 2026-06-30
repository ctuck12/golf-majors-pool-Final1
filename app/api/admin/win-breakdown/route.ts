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

// Lists every winning row (position === '1') from the per-year PlayerProfileTournamentRow data.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '40098';
  const r = await gql(`query R($id: ID!){
    playerProfileTournamentResults(playerId:$id, tourCode:R){
      tournaments {
        tournamentOverview { tournamentName }
        tournaments { position year tournamentName date }
      }
    }
  }`, { id }) as {
    data?: { playerProfileTournamentResults?: { tournaments?: Array<{ tournamentOverview?: { tournamentName?: string }; tournaments?: Array<{ position?: string; year?: string; tournamentName?: string; date?: string }> }> } };
    errors?: Array<{ message?: string }>;
  };
  if (r?.errors?.length) return Response.json({ error: r.errors[0]?.message });
  const groups = r?.data?.playerProfileTournamentResults?.tournaments ?? [];
  const positions = new Set<string>();
  const wins: Array<{ tournament: string; year: string; position: string }> = [];
  for (const g of groups) {
    const groupName = g.tournamentOverview?.tournamentName ?? '';
    for (const row of g.tournaments ?? []) {
      if (row.position != null) positions.add(String(row.position));
      if (String(row.position) === '1') {
        wins.push({ tournament: row.tournamentName || groupName, year: String(row.year ?? ''), position: String(row.position) });
      }
    }
  }
  wins.sort((a, b) => a.year.localeCompare(b.year));
  return Response.json({ id, winCount: wins.length, wins, distinctPositions: [...positions].sort() });
}
