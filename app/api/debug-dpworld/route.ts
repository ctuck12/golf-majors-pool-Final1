export const dynamic = 'force-dynamic';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function tryGql(label: string, query: string, variables: Record<string, unknown> = {}) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return { label, status: res.status, data };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // Probe RTD cup directly
    tryGql('tourCup-rtd', `query { tourCup(id: "R-2700-2026") { rankings { __typename } standings { __typename } } }`),
    // Introspect PriorityRankings fields
    tryGql('priorityRankingsFields', `{ __type(name: "PriorityRankings") { fields { name } } }`),
    // Introspect TourCupRankingData fields
    tryGql('tourCupRankingData', `{ __type(name: "TourCupRankingData") { fields { name } } }`),
    // Introspect TourCupRanking fields (the standings row type)
    tryGql('tourCupRankingFields', `{ __type(name: "TourCupRanking") { fields { name } } }`),
    // Try fetching actual standings with player data
    tryGql('tourCup-rtd-standings', `query { tourCup(id: "R-2700-2026") { standings { __typename } } }`),
    // Try fetching rankings array
    tryGql('tourCup-rtd-rankings-items', `query { tourCup(id: "R-2700-2026") { rankings { rank player { id displayName } points } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
