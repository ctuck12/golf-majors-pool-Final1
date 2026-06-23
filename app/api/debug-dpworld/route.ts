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

async function tryFetch(label: string, url: string, options: RequestInit = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    return { label, status: res.status, body: text.slice(0, 4000) };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // priorityRankings requires tourCode — try DP World / European Tour codes
    tryGql('priorityRankings-R', `query { priorityRankings(tourCode: "R") { __typename } }`),
    tryGql('priorityRankings-E', `query { priorityRankings(tourCode: "E") { __typename } }`),
    // playerHub with correct playerId arg (not id)
    tryGql('playerHub-rory', `query { playerHub(playerId: "28237") { __typename } }`),
    // Introspect TourCup type to find fields
    tryGql('tourCup-introspect', `{ __type(name: "TourCupRankingEvent") { fields { name } } }`),
    tryGql('tourCup-id-arg', `query { tourCup(id: "R2026") { __typename } }`),
    // Try OWGR direct API (they have a REST API backing their Next.js site)
    tryFetch('owgr-api-ranking', 'https://api.owgr.com/events/latest/ranking?pageNo=1&pageSize=5&country=All', {
      headers: { 'Accept': 'application/json', 'Origin': 'https://www.owgr.com', 'Referer': 'https://www.owgr.com/' }
    }),
    // Try OWGR REST API alternate path
    tryFetch('owgr-api2', 'https://www.owgr.com/api/owgr/ranking?pageNo=1&pageSize=5&country=All', {
      headers: { 'Accept': 'application/json' }
    }),
    // Try SofaScore golf rankings
    tryFetch('sofascore-rtd', 'https://api.sofascore.com/api/v1/sport/golf/rankings', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    }),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
