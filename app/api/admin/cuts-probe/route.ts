export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Diagnostic: find the "cuts made" field on the PGA overviewInfo type, and inspect the
// position strings in major results so we can compute major cuts made. Default id = Fitzpatrick.
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '40098';

  // 1) Get the concrete type name of overviewInfo, plus current known values.
  const typenameRes = await gql(`query R($id: ID!){
    playerProfileTournamentResults(playerId:$id, tourCode:R){
      tournaments { tournamentOverview { tournamentName } overviewInfo { __typename events wins money } }
    }
  }`, { id }) as { data?: { playerProfileTournamentResults?: { tournaments?: Array<{ overviewInfo?: { __typename?: string } }> } }; errors?: Array<{ message?: string }> };
  const overviewType = typenameRes?.data?.playerProfileTournamentResults?.tournaments?.[0]?.overviewInfo?.__typename ?? null;

  // 2) Introspect that type's fields.
  let overviewFields: string[] = [];
  if (overviewType) {
    const introspect = await gql(`query T($n: String!){ __type(name: $n){ fields { name type { name kind ofType { name } } } } }`, { n: overviewType }) as { data?: { __type?: { fields?: Array<{ name?: string; type?: { name?: string; kind?: string; ofType?: { name?: string } } }> } } };
    overviewFields = (introspect?.data?.__type?.fields ?? []).map((f) => `${f.name}:${f.type?.name ?? f.type?.ofType?.name ?? f.type?.kind}`);
  }

  // 3) Major results — dump distinct position strings so we can define "made cut".
  const majorRes = await gql(`query M($id: String!){
    playerProfileMajorResults(playerId:$id){ tournaments { year position tournamentName } }
  }`, { id }) as { data?: { playerProfileMajorResults?: { tournaments?: Array<{ position?: unknown; year?: unknown; tournamentName?: unknown }> } } };
  const majorTourns = majorRes?.data?.playerProfileMajorResults?.tournaments ?? [];
  const majorPositions = [...new Set(majorTourns.map((t) => String(t.position ?? '')))].sort();

  return Response.json({
    id,
    overviewType,
    overviewFields,
    overviewTypenameErrors: typenameRes?.errors ?? null,
    majorCount: majorTourns.length,
    majorPositions,
  });
}
