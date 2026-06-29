export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaId = searchParams.get('pgaId') ?? '46046';

  const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
  const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
  const gqlHeaders = { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };

  const results: Record<string, unknown> = {};

  // Discover sub-types via __typename
  try {
    const q = `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { tournaments { __typename } timelineTournaments { __typename } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['typename_probe'] = j;
  } catch (e) { results['typename_error'] = String(e); }

  // Try with common field names for tournament results
  try {
    const q = `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { timelineHeaders tournaments { wins starts tourId displayName } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['tournaments_probe'] = j;
  } catch (e) { results['tournaments_error'] = String(e); }

  // Try timelineTournaments
  try {
    const q = `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { timelineHeaders timelineTournaments { year finishes } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['timeline_probe'] = j;
  } catch (e) { results['timeline_error'] = String(e); }

  return Response.json(results);
}
