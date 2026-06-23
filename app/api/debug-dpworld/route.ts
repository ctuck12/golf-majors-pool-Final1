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
    // PlayerHub works! Introspect PlayerHubPlayerCompressed type to find ranking fields
    tryGql('playerHubType', `{ __type(name: "PlayerHubPlayerCompressed") { fields { name } } }`),
    // Also introspect PlayerHubPlayer type (uncompressed might exist)
    tryGql('playerHubPlayerType', `{ __type(name: "PlayerHubPlayer") { fields { name } } }`),
    // TourCode enum values
    tryGql('tourCodeEnum', `{ __type(name: "TourCode") { enumValues { name } } }`),
    // TourCupRankingEvent has standings — introspect it
    tryGql('tourCupStandingsType', `{ __type(name: "TourCupStanding") { fields { name } } }`),
    // Try tourCups (plural) - list of available cups
    tryGql('tourCups', `query { tourCups(tourCode: "PGA") { __typename id title } }`),
    // Fetch playerHub for Rory with all potential ranking fields
    tryGql('playerHub-rory-full', `query { playerHub(playerId: "28237") { rankings { __typename } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
