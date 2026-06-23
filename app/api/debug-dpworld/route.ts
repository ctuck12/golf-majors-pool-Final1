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
    // Fetch real RTD rankings with position+id+name+total
    tryGql('rtd-real-data', `query { tourCup(id: "R-2700-2026") { rankings { ... on CupRankingPlayer { position id name total } } } }`),
    // Scheffler pgaTourId=46046, Rory=28237 — look them up
    tryGql('rtd-scheffler-check', `query { tourCup(id: "R-2700-2026") { rankings { ... on CupRankingPlayer { position id name } } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
