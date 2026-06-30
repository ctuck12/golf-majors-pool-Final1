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
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}

export async function GET(request: Request) {
  const tournamentId = new URL(request.url).searchParams.get('tournamentId') ?? 'R2026033';
  const statId = new URL(request.url).searchParams.get('statId') ?? '02675';
  const out: Record<string, unknown> = { tournamentId, statId };

  // Introspect the eventQuery input + the queryType enum values
  const introQ = `query { a: __type(name: "StatDetailEventQuery") { inputFields { name type { kind name ofType { kind name enumValues { name } } } } } b: __type(name: "StatDetailQueryType") { enumValues { name } } c: __type(name: "TournamentPastEventQueryType") { enumValues { name } } }`;
  out.introspect = await gql(introQ, {});

  // Try statDetails scoped to the tournament with several plausible queryType enum literals.
  const tryQueryType = async (qt: string) => {
    const q = `query($statId: String!, $tournamentId: String!) {
      statDetails(tourCode: R, statId: $statId, year: 2026, eventQuery: { tournamentId: $tournamentId, queryType: ${qt} }) {
        tournamentPills { tournamentId }
        rows { ... on StatDetailsPlayer { playerName rank stats { ... on CategoryPlayerStat { statValue } } } }
      }
    }`;
    const r = await gql(q, { statId, tournamentId }) as { data?: { statDetails?: { rows?: unknown[] } }; errors?: Array<{ message: string }> };
    const rows = r?.data?.statDetails?.rows;
    return { qt, ok: Array.isArray(rows) && rows.length > 0, rowCount: Array.isArray(rows) ? rows.length : 0, sample: Array.isArray(rows) ? rows.slice(0, 3) : null, error: r?.errors?.[0]?.message };
  };

  out.attempts = [];
  for (const qt of ['EVENT_ONLY', 'TOURNAMENT_ONLY', 'PLAYER_TOURNAMENT', 'EVENT', 'TOURNAMENT']) {
    (out.attempts as unknown[]).push(await tryQueryType(qt));
  }

  return Response.json(out);
}
