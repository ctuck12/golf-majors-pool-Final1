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
    // Introspect PriorityCategory (not PriorityRankingsCategory)
    tryGql('PriorityCategory-fields', `{ __type(name: "PriorityCategory") { fields { name type { name kind ofType { name } } } } }`),
    // tourCup with type: OFFICIAL — may return more players
    tryGql('tourCup-official', `query { tourCup(id: "R-2700-2026", type: OFFICIAL) { rankings { ... on CupRankingPlayer { position id name } } } }`),
    // tourCup with type: OFFICIAL_AND_PROJECTED
    tryGql('tourCup-official-projected', `query { tourCup(id: "R-2700-2026", type: OFFICIAL_AND_PROJECTED) { rankings { ... on CupRankingPlayer { position id name } } } }`),
    // priorityRankings categories with actual fields
    tryGql('priorityRankings-categories-data', `query { priorityRankings(tourCode: R) { categories { ... on PriorityCategory { title description } } } }`),
    // tourCupCombined
    tryGql('tourCupCombined', `query { tourCupCombined(tourCode: R, id: "2700", year: 2026) { __typename } }`),
    // statDetails with RTD stat id 02700 but tourCode E (European)
    tryGql('statDetails-E-02700', `query { statDetails(tourCode: E, statId: "02700", year: 2026) { rows { ... on StatDetailsPlayer { rank playerName playerId } } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
