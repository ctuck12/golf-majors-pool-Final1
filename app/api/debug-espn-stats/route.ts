export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '9478';
  const pgaId = searchParams.get('pgaId') ?? '46046';

  const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
  const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
  const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
  const gqlHeaders = { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };

  const results: Record<string, unknown> = {};

  // 1. PGA Tour GQL: introspect Query type to find available fields
  try {
    const query = `{ __type(name: "Query") { fields { name args { name type { name kind ofType { name } } } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['pga_query_fields'] = j?.data?.__type?.fields?.map((f) => f.name);
  } catch (e) { results['pga_query_error'] = String(e); }

  // 2. PGA Tour GQL: try playerBio as direct query (correct field name from schema)
  try {
    const query = `query Q($id: ID!) { playerBio(playerId: $id) { careerEarnings school turnedPro born overview } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['pga_playerBio_direct'] = j;
  } catch (e) { results['pga_playerBio_error'] = String(e); }

  // 3. ESPN Core statisticslog
  try {
    const r = await fetch(`${ESPN_CORE}/athletes/${espnId}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json() as Record<string, unknown>;
    const statslog = j?.statisticslog as Record<string, unknown> | undefined;
    results['statisticslog_ref'] = statslog;
    if (statslog?.$ref) {
      const r2 = await fetch(String(statslog.$ref), { signal: AbortSignal.timeout(6000) });
      const j2 = await r2.json();
      results['statisticslog_data'] = JSON.stringify(j2).slice(0, 3000);
    }
  } catch (e) { results['statisticslog_error'] = String(e); }

  // 4. ESPN Core seasons list for athlete
  try {
    const r = await fetch(`${ESPN_CORE}/athletes/${espnId}/statisticslog`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['statslog_direct'] = JSON.stringify(j).slice(0, 3000);
  } catch (e) { results['statslog_direct_error'] = String(e); }

  // 5. Try ESPN Core seasons endpoint for career totals
  try {
    const r = await fetch(`${ESPN_CORE}/athletes/${espnId}/seasons`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['seasons_data'] = JSON.stringify(j).slice(0, 2000);
  } catch (e) { results['seasons_error'] = String(e); }

  // 6. ESPN Core gamelog (may have tournament-by-tournament including majors)
  try {
    const r = await fetch(`https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${espnId}/gamelog`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json() as Record<string, unknown>;
    results['gamelog_keys'] = Object.keys(j ?? {});
    results['gamelog_partial'] = JSON.stringify(j).slice(0, 2000);
  } catch (e) { results['gamelog_error'] = String(e); }

  return Response.json(results);
}
