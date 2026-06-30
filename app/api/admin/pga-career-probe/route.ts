export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

export async function GET() {
  // Introspect the TournamentResults element type (position, money, season, etc.).
  const types = await gql(`{
    tr: __type(name:"TournamentResults"){ fields { name type { kind name ofType { kind name } } } }
  }`);

  return Response.json({ types });
}
