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
    // TourCode enum R is valid — pass without quotes (enum value not string)
    tryGql('priorityRankings-R-enum', `query { priorityRankings(tourCode: R) { __typename } }`),
    // Get tourCups with correct args - tour enum, year int
    tryGql('tourCups-R-2026', `query { tourCups(tour: R, year: 2026) { id title } }`),
    // PlayerHub payload — it's compressed, try decoding it
    tryGql('playerHub-payload', `query { playerHub(playerId: "28237") { payload } }`),
    // Introspect priorityRankings return type
    tryGql('priorityRankingsType', `{ __type(name: "Query") { fields { name args { name type { name kind ofType { name } } } } } }`),
    // Try playerProfileStats with just id to get what fields work
    tryGql('playerProfileStats-test', `query { playerProfileStats(playerId: "28237", tourCode: PGA, year: 2026) { __typename } }`),
    // tourCup with tour enum
    tryGql('tourCup-introspect-args', `{ __type(name: "TourCupRankingEvent") { fields { name type { name kind ofType { name } } } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
