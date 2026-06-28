export const dynamic = 'force-dynamic';

// Debug: probe statDetails GQL with correct args and introspect StatDetailsRow type.

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
    // Introspect StatDetailsRow to find its fields
    tryGql('StatDetailsRow-fields', `query { __type(name: "StatDetailsRow") { fields { name type { name kind ofType { name } } } } }`),

    // Try statDetails with correct tourCode arg
    tryGql('statDetails-130-R', `query { statDetails(tourCode: R, statId: "130") { rows { __typename } } }`),

    // Also introspect StatLeaderCategory
    tryGql('StatLeaderCategory-fields', `query { __type(name: "StatLeaderCategory") { fields { name type { name kind ofType { name } } } } }`),

    // playerProfileStatsFull — might give all stats for a player by year
    tryGql('playerProfileStatsFull-46046', `
      query { playerProfileStatsFull(playerId: "46046") { stats { statId value rank } } }
    `),
  ]);

  return Response.json({ results });
}
