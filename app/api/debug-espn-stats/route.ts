export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaId = searchParams.get('pgaId') ?? '46046'; // Scheffler default

  const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
  const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
  const headers = { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };
  const post = (q: string, v?: Record<string, unknown>) =>
    fetch(PGA_GQL, { method: 'POST', headers, body: JSON.stringify({ query: q, variables: v }), signal: AbortSignal.timeout(8000) }).then(r => r.json());

  const results: Record<string, unknown> = {};

  // 1. Introspect MajorResultsTournament field names
  try {
    const d = await post(`{ __type(name: "MajorResultsTournament") { fields { name type { name kind ofType { name kind } } } } }`) as { data?: { __type?: { fields?: Array<{ name: string; type: unknown }> } } };
    results['MajorResultsTournament_fields'] = d?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['mrt_err'] = String(e); }

  // 2. Introspect MajorTimeline field names
  try {
    const d = await post(`{ __type(name: "MajorTimeline") { fields { name type { name kind ofType { name kind } } } } }`) as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['MajorTimeline_fields'] = d?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['mt_err'] = String(e); }

  // 3. Count entries with __typename only (always works)
  try {
    const d = await post(`query Q($id: String!) { playerProfileMajorResults(playerId: $id) { tournaments { __typename } timelineTournaments { __typename } timelineHeaders } }`, { id: pgaId }) as { data?: { playerProfileMajorResults?: { tournaments?: unknown[]; timelineTournaments?: unknown[]; timelineHeaders?: unknown } }; errors?: unknown[] };
    results['errors'] = d?.errors;
    results['tournamentCount'] = d?.data?.playerProfileMajorResults?.tournaments?.length;
    results['timelineCount'] = d?.data?.playerProfileMajorResults?.timelineTournaments?.length;
    results['timelineHeaders'] = d?.data?.playerProfileMajorResults?.timelineHeaders;
  } catch (e) { results['count_err'] = String(e); }

  // 4. Try querying all likely field names in one shot to see which ones don't error
  try {
    const d = await post(`query Q($id: String!) { playerProfileMajorResults(playerId: $id) { tournaments { year tournamentName wins losses starts appearances finish finishPosition score champion isChampion winner isWinner result place eventName name } } }`, { id: pgaId }) as { data?: unknown; errors?: Array<{ message: string }> };
    results['field_probe_errors'] = d?.errors?.map(e => e.message);
    results['field_probe_sample'] = (d?.data as { playerProfileMajorResults?: { tournaments?: unknown[] } } | undefined)?.playerProfileMajorResults?.tournaments?.slice(0, 2);
  } catch (e) { results['probe_err'] = String(e); }

  return Response.json(results);
}
