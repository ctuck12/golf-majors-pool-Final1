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

// Discover the per-year result fields inside playerProfileTournamentResults so we can list
// individual victories (tournament + year). Introspects the inner element type + samples Fitz.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '40098';

  // 1) What is the inner `tournaments` element type, and what fields does it have?
  const typeName = await gql(`query R($id: ID!){ playerProfileTournamentResults(playerId:$id, tourCode:R){ tournaments { tournaments { __typename } } } }`, { id });

  // 2) Try a set of plausible per-result fields; errors will reveal the valid ones.
  const sample = await gql(`query R($id: ID!){
    playerProfileTournamentResults(playerId:$id, tourCode:R){
      tournaments {
        tournamentOverview { tournamentName displaySeason }
        tournaments { position finishPosition year season displaySeason date tournamentName }
      }
    }
  }`, { id });

  return Response.json({ id, typeName, sample });
}
