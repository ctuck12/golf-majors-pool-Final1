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
  // 1) Introspect PlayerBioWrapper (what `player(id)` returns) and list all root queries.
  const introspect = await gql(`{
    bio: __type(name:"PlayerBioWrapper"){ fields { name type { name kind ofType { name kind } } } }
    root: __type(name:"Query"){ fields { name } }
  }`);

  // 2) Pull a real player record via player(id) using a broad set of plausible bio fields,
  //    so even if introspection is blocked we learn which resolve. Scheffler control.
  const playerProbe = await gql(
    `query P($id: ID!){ player(id:$id){ id firstName lastName country countryFlag bornAccountedFor } }`,
    { id: '46046' },
  );

  return Response.json({ introspect, playerProbe });
}
