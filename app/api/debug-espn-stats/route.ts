export const dynamic = 'force-dynamic';

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
    tryGql('CategoryPlayerStat-fields', `query { __type(name: "CategoryPlayerStat") { fields { name type { name kind ofType { name } } } } }`),

    // Try with stats fields guessed from categoryPlayerStat
    tryGql('statDetails-130-with-stats', `
      query {
        statDetails(tourCode: R, statId: "130") {
          rows {
            ... on StatDetailsPlayer {
              playerId
              playerName
              rank
              stats {
                ... on CategoryPlayerStat {
                  statValue
                  statId
                }
              }
            }
            ... on StatDetailTourAvg {
              displayName
              value
            }
          }
        }
      }
    `),
  ]);

  return Response.json({ results });
}
