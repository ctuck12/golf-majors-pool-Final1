export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaId = searchParams.get('pgaId') ?? '46046';

  const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
  const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
  const gqlHeaders = { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };

  const results: Record<string, unknown> = {};

  // Introspect MajorResultsTournament
  try {
    const q = `{ __type(name: "MajorResultsTournament") { fields { name type { name kind } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['MajorResultsTournament_fields'] = j?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['mrt_error'] = String(e); }

  // Introspect MajorTimeline
  try {
    const q = `{ __type(name: "MajorTimeline") { fields { name type { name kind } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['MajorTimeline_fields'] = j?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['mt_error'] = String(e); }

  // Also get the full data using __typename-only fields to see what we get
  try {
    const q = `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { timelineHeaders timelineTournaments { __typename } tournaments { __typename } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { playerProfileMajorResults?: { timelineHeaders?: unknown } } };
    results['timelineHeaders'] = j?.data?.playerProfileMajorResults?.timelineHeaders;
  } catch (e) { results['headers_error'] = String(e); }

  return Response.json(results);
}
