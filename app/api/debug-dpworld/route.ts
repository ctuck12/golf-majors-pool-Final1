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
    // Introspect top-level Query fields for anything DP World / standings related
    tryGql('introspect-query-fields', `{ __type(name: "Query") { fields { name description } } }`),
    // Try playerBio with Rory McIlroy (28237 is his PGA Tour ID)
    tryGql('playerBio-rory', `query { playerBio(id: "28237") { id displayName tourMemberships { tourCode tourName } dpWorldRank raceToDubaiRank dpWorldPoints } }`),
    // Try playerById
    tryGql('playerById-rory', `query { playerById(id: "28237") { id displayName rankings { dpWorldRank raceToDubai { rank points } } } }`),
    // Try the known playerProfileStats to see if it has rankings/standings
    tryGql('playerProfileStats-rory', `query { playerProfileStats(playerId: "28237") { id statGroups { stats { statId value rank } } dpWorldRank raceToDubaiRank } }`),
    // Try a player stats query with broader fields
    tryGql('playerSeasonStats-rory', `query { playerSeasonStats(playerId: "28237", year: 2026) { dpWorldRank raceToDubai { rank points } } }`),
    // Try leaderStandings
    tryGql('leaderStandings-dp', `query { leaderStandings(tourCode: "DP", season: 2026) { players { rank displayName points } } }`),
    // Try orderOfMerit
    tryGql('orderOfMerit', `query { orderOfMerit(year: 2026) { players { rank name points } } }`),
    // Try tourLeaderboard
    tryGql('tourLeaderboard', `query { tourLeaderboard(tourCode: "DP") { players { rank player { displayName } points } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
