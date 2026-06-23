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
    // Introspect TourCupCombinedRow — actual type of players items
    tryGql('TourCupCombinedRow', `{ __type(name: "TourCupCombinedRow") { fields { name type { name kind ofType { name } } } } }`),
    // tourCupSplit officialPlayers
    tryGql('split-officialPlayers', `query { tourCupSplit(tourCode: R, id: "2700", year: 2026) { officialPlayers { __typename } } }`),
    // tourCupCombined players with __typename to find actual type
    tryGql('combined-players-typename', `query { tourCupCombined(tourCode: R, id: "2700", year: 2026) { players { __typename } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
