export const dynamic = 'force-dynamic';

// Debug: probe statLeaders and statDetails GQL queries for scrambling (stat 130).

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

async function tryGql(label: string, query: string, variables: Record<string, unknown> = {}) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { label, status: res.status, response: parsed };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // Try statLeaders — likely replacement for statLeaderboard
    tryGql('statLeaders-130-introspect', `query { __type(name: "Query") { fields { name args { name type { name kind ofType { name kind } } } } } }`),

    tryGql('statLeaders-130', `query { statLeaders(statId: "130") { rows { rank displayValue player { firstName lastName } } } }`),

    tryGql('statLeaders-130-v2', `query($statId: ID!) { statLeaders(statId: $statId) { rows { rank displayValue player { firstName lastName } } } }`, { statId: '130' }),

    tryGql('statDetails-130', `query { statDetails(statId: "130") { rows { rank displayValue player { firstName lastName } } } }`),

    tryGql('statOverview-130', `query { statOverview(statId: "130") { rows { rank displayValue player { firstName lastName } } } }`),

    // Introspect what args statLeaders accepts
    tryGql('statLeaders-schema', `query { __type(name: "Query") { fields(includeDeprecated: true) { name args { name type { name kind ofType { name } } } } } }`),
  ]);

  return Response.json({ results });
}
