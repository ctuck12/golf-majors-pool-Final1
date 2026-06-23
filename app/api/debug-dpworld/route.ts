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
    // defaultTourCup for E tour (pure DP World / European Tour)
    tryGql('defaultTourCup-E', `query { defaultTourCup(tour: E) { id title } }`),
    // tourCups for E tour
    tryGql('tourCups-E-2026', `query { tourCups(tour: E, year: 2026) { id title } }`),
    // statLeaderboard for RTD stat 02700 (no tournament = season standings)
    tryGql('statLeaderboard-02700', `query { statLeaderboard(statId: "02700") { rows { rank player { id displayName } } } }`),
    // statLeaderboard with tourCode R for stat 02671 (FedEx-like but for RTD)
    tryGql('statDetails-R-02700', `query { statDetails(tourCode: R, statId: "02700", year: 2026) { rows { __typename } } }`),
    // tourCup standings with type PROJECTED — may populate rankings
    tryGql('tourCup-projected-standings', `query { tourCup(id: "R-2700-2026", type: PROJECTED) { standings { ... on StandardCupRanking { rankings { ... on CupRankingPlayer { position id name } } } } } }`),
    // Introspect StatLeaderboard — check if it has a tournamentId-optional signature
    tryGql('StatLeaderboard-type', `{ __type(name: "StatLeaderboard") { fields { name type { name kind } } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
