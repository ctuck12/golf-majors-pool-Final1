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
  const u = new URL(request.url);
  const tournamentId = u.searchParams.get('tournamentId') ?? 'R2026033';
  // Candidate scrambling stat IDs to probe. 130 = scorecard scrambling; others are guesses.
  const ids = (u.searchParams.get('ids') ?? '101,103,111,130,02428,02429,447,484').split(',');
  const out: Record<string, unknown> = { tournamentId };

  const q = `query($statId: String!, $tournamentId: String!) {
    statDetails(tourCode: R, statId: $statId, year: 2026, eventQuery: { tournamentId: $tournamentId, queryType: EVENT_ONLY }) {
      statTitle
      rows { ... on StatDetailsPlayer { playerName rank stats { ... on CategoryPlayerStat { statName statValue } } } }
    }
  }`;

  for (const statId of ids) {
    const r = await gql(q, { statId, tournamentId }) as { data?: { statDetails?: { statTitle?: string; rows?: Array<{ playerName?: string; rank?: number; stats?: Array<{ statName?: string; statValue?: string }> }> } }; errors?: unknown };
    const sd = r?.data?.statDetails;
    const smalley = sd?.rows?.find((row) => (row.playerName ?? '').includes('Smalley'));
    out[statId] = {
      statTitle: sd?.statTitle,
      rowCount: sd?.rows?.length ?? 0,
      columns: smalley?.stats?.map((s) => `${s.statName}=${s.statValue}`) ?? sd?.rows?.[0]?.stats?.map((s) => `${s.statName}=${s.statValue}`),
      smalley: smalley ? { rank: smalley.rank } : null,
      err: r?.errors ?? null,
    };
  }

  return Response.json(out);
}
