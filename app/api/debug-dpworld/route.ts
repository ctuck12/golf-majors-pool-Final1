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
    // Introspect CupRankingPlayerWrapper — the actual wrapper type
    tryGql('CupRankingPlayerWrapper', `{ __type(name: "CupRankingPlayerWrapper") { fields { name type { name kind ofType { name } } } } }`),
    // Introspect CupRankingPlayer — the player row type
    tryGql('CupRankingPlayer', `{ __type(name: "CupRankingPlayer") { fields { name type { name kind ofType { name } } } } }`),
    // Introspect StandardCupRanking — the standings type
    tryGql('StandardCupRanking', `{ __type(name: "StandardCupRanking") { fields { name type { name kind ofType { name } } } } }`),
    // Try inline fragments on rankings to get CupRankingPlayer fields
    tryGql('rankings-inline-frag', `query { tourCup(id: "R-2700-2026") { rankings { ... on CupRankingPlayer { __typename } } } }`),
    // Introspect CupRankingPlayerInfoRow
    tryGql('CupRankingPlayerInfoRow', `{ __type(name: "CupRankingPlayerInfoRow") { fields { name type { name kind ofType { name } } } } }`),
    // priorityRankings categories fields
    tryGql('priorityRankings-categories', `{ __type(name: "PriorityRankingsCategory") { fields { name type { name kind ofType { name } } } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
