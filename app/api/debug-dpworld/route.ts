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
    return { label, status: res.status, body: text.slice(0, 3000) };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // Probe priorityRankings - might have DP World / Race to Dubai
    tryGql('priorityRankings', `{ priorityRankings { __typename } }`),
    // Probe playerHub for Rory (28237) - might expose rankings
    tryGql('playerHub-rory', `query { playerHub(id: "28237") { __typename } }`),
    // Probe player query fields
    tryGql('player-rory-introspect', `{ __type(name: "Player") { fields { name } } }`),
    // Try player with ranking-related fields
    tryGql('player-rory', `query { player(id: "28237") { id displayName rankings { rankTypeId rankTypeName rank } } }`),
    // Try tourCup for DP World Tour
    tryGql('tourCup-dp', `query { tourCup(tourCode: "R", year: 2026) { __typename players { rank player { displayName } points } } }`),
    // Try the europeantour.com Race to Dubai standings JSON feed directly
    tryFetch('europeantour-rtd', 'https://www.europeantour.com/api/feeds/?feed=stats&tour=DP&format=json&type=standings', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'application/json' }
    }),
    // Try DP World Tour live scores / standings feed
    tryFetch('dpworldtour-standings', 'https://feeds.europeantour.com/feeds/stats/2026/standings.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': '*/*' }
    }),
    // Try OWGR rankings
    tryFetch('owgr', 'https://www.owgr.com/ranking?pageNo=1&pageSize=50&country=All', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json, text/html' }
    }),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
