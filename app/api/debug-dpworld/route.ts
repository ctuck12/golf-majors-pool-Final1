export const dynamic = 'force-dynamic';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function tryFetch(label: string, url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...init });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text.slice(0, 800); }
    return { label, status: res.status, ok: res.ok, url, data: json };
  } catch (e) {
    return { label, error: String(e), url };
  }
}

async function tryGql(label: string, query: string, variables: Record<string, unknown> = {}) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return { label, status: res.status, ok: res.ok, data };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // ESPN euro league
    tryFetch('espn-euro-league', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/euro'),
    tryFetch('espn-euro-seasons', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/euro/seasons'),
    tryFetch('espn-euro-rankings-2026', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/euro/seasons/2026/rankings?limit=20'),
    tryFetch('espn-euro-rankings-1', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/euro/seasons/2026/rankings/1'),
    // PGA GQL - DP World / Ryder Cup / European standings queries
    tryGql('gql-standings-dpworld', `query { standings(tourCode: "DP", season: 2026) { tours { tourCode players { player { displayName } rank points } } } }`),
    tryGql('gql-standings-rtd', `query { raceToDubaiStandings { players { player { displayName } rank points } } }`),
    tryGql('gql-tourstandings', `query TourStandings($tourCode: String!, $season: Int!) { tourStandings(tourCode: $tourCode, season: $season) { players { rank player { displayName } } } }`, { tourCode: 'DP', season: 2026 }),
    tryGql('gql-playerprofile-dpworld', `query { playerProfile(playerId: "28237") { dpWorldRank dpWorldPoints raceToDubaiRank } }`),
    tryGql('gql-playerprofile-full', `query { playerProfile(playerId: "28237") { id displayName tourBoundMemberships { tourCode memberType } } }`),
    // European Tour content API alternatives
    tryFetch('euro-stats-api', 'https://stats.europeantour.com/api/rankings/race-to-dubai?year=2026&limit=10', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    }),
    tryFetch('euro-content-api', 'https://content.europeantour.com/api/v1/rankings?type=race-to-dubai&limit=10'),
    tryFetch('euro-gql', 'https://api.europeantour.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ rankings(type: "race-to-dubai", limit: 5) { rank name points } }' })
    }),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
