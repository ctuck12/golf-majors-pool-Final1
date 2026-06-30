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
  const SG = { sgTotal: '02675', sgTeeToGreen: '02674', sgOffTee: '02567', sgApproach: '02568', sgAroundGreen: '02569', sgPutting: '02564' };
  const out: Record<string, unknown> = { tournamentId };

  const q = `query($statId: String!, $tournamentId: String!) {
    statDetails(tourCode: R, statId: $statId, year: 2026, eventQuery: { tournamentId: $tournamentId, queryType: EVENT_ONLY }) {
      statTitle
      rows { ... on StatDetailsPlayer { playerName rank stats { ... on CategoryPlayerStat { statName statValue } } } }
    }
  }`;

  for (const [field, statId] of Object.entries(SG)) {
    const r = await gql(q, { statId, tournamentId }) as { data?: { statDetails?: { statTitle?: string; rows?: Array<{ playerName?: string; rank?: number; stats?: Array<{ statName?: string; statValue?: string }> }> } } };
    const sd = r?.data?.statDetails;
    const firstWithStats = sd?.rows?.find((row) => Array.isArray(row.stats) && row.stats.length > 0);
    out[field] = {
      statTitle: sd?.statTitle,
      rowCount: sd?.rows?.length ?? 0,
      columns: firstWithStats?.stats?.map((s) => `${s.statName}=${s.statValue}`),
      sampleRow: firstWithStats ? { name: firstWithStats.playerName, rank: firstWithStats.rank } : null,
    };
  }

  return Response.json(out);
}
