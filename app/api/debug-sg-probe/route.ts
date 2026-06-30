export const dynamic = 'force-dynamic';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables: Record<string, unknown>) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return { httpOk: res.ok, status: res.status, body: await res.json() };
  } catch (e) { return { __error: String(e) }; }
}

export async function GET(request: Request) {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId') ?? 'R2026033'; // Masters 2026
  const statId = new URL(request.url).searchParams.get('statId') ?? '02675'; // SG Total (tournament)
  const out: Record<string, unknown> = { tournamentId, statId };

  // 1. Introspect Query fields whose name mentions stat/tournament
  const introspect = `query { __schema { queryType { fields { name args { name type { name kind ofType { name } } } } } } }`;
  const intro = await gql(introspect, {});
  const fields = (intro as { body?: { data?: { __schema?: { queryType?: { fields?: Array<{ name: string; args: Array<{ name: string }> }> } } } } })
    .body?.data?.__schema?.queryType?.fields ?? [];
  out.statishQueries = fields
    .filter((f) => /stat|leaderboard|tourn/i.test(f.name))
    .map((f) => `${f.name}(${f.args.map((a) => a.name).join(', ')})`);

  // 2. Candidate A: statLeaderboard(statId, tournamentId) with richer fields
  out.candidateA = await gql(
    `query($statId: ID!, $tournamentId: ID!) { statLeaderboard(statId: $statId, tournamentId: $tournamentId) { rows { rank displayValue player { id firstName lastName } } } }`,
    { statId, tournamentId }
  );

  // 3. Candidate B: tournamentStatDetails / statDetails with tournament arg
  out.candidateB = await gql(
    `query($statId: String!, $tournamentId: String!) { statDetails(tourCode: R, statId: $statId, eventQuery: { tournamentPubId: $tournamentId, year: 2026 }) { rows { ... on StatDetailsPlayer { playerName rank stats { ... on CategoryPlayerStat { statValue } } } } } }`,
    { statId, tournamentId }
  );

  return Response.json(out);
}
