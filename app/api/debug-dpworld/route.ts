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
    // Try type=FULL or other TourCupType enum values
    tryGql('tourCupType-enum', `{ __type(name: "TourCupType") { enumValues { name } } }`),
    // Try with type arg on tourCup
    tryGql('tourCup-type-arg', `query { tourCup(id: "R-2700-2026", type: FULL) { rankings { ... on CupRankingPlayer { position id name } } } }`),
    // Try standings.rankings (StandardCupRanking has a rankings field)
    tryGql('standings-rankings', `query { tourCup(id: "R-2700-2026") { standings { ... on StandardCupRanking { rankings { ... on CupRankingPlayer { position id name } } } } } }`),
    // priorityRankings with tourCode R — categories fields
    tryGql('priorityRankings-R-full', `query { priorityRankings(tourCode: R) { categories { __typename } } }`),
    // Introspect PriorityRankingsCategory
    tryGql('PriorityRankingsCategory', `{ __type(name: "PriorityRankingsCategory") { fields { name type { name kind ofType { name } } } } }`),
    // statDetails for RTD stat — stat 02671 is FedEx, try 02700 for RTD
    tryGql('statDetails-rtd', `query { statDetails(tourCode: R, statId: "02700", year: 2026) { rows { ... on StatDetailsPlayer { rank playerName playerId } } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
