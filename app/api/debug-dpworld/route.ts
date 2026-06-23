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
    // Try full id format
    tryGql('combined-full-id', `query { tourCupCombined(tourCode: R, id: "R-2700-2026", year: 2026) { players { id displayName officialSort } } }`),
    // Try without year
    tryGql('combined-no-year', `query { tourCupCombined(tourCode: R, id: "2700") { players { id displayName officialSort } } }`),
    // tourCupSplit fields and data
    tryGql('tourCupSplit-fields', `{ __type(name: "TourCupSplit") { fields { name type { name kind ofType { name } } } } }`),
    tryGql('tourCupSplit-players', `query { tourCupSplit(tourCode: R, id: "2700", year: 2026) { players { __typename } } }`),
    // Try tourCode E (European Tour)
    tryGql('combined-tourcode-E', `query { tourCupCombined(tourCode: E, id: "2700", year: 2026) { players { id displayName officialSort } } }`),
    // defaultTourCup for R
    tryGql('defaultTourCup-R', `query { defaultTourCup(tour: R) { id title } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
