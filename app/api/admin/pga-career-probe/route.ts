export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

export async function GET() {
  const types = await gql(`{
    overview: __type(name:"TournamentResultOverview"){ fields { name type { kind name ofType { kind name } } } }
    info: __type(name:"TournamentOverviewInfo"){ fields { name type { kind name ofType { kind name } } } }
  }`);

  // Sample the season-overview shape for Jayden Schaper (57737).
  const sample = await gql(
    `query R($id: ID!){ playerProfileTournamentResults(playerId: $id, tourCode: R){ tournaments { tournamentNum cupEyebrowText } } }`,
    { id: '57737' },
  );

  return Response.json({ types, sample });
}
