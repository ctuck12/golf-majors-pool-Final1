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

  // 1. PGA Tour: player query (may return bio with careerEarnings)
  try {
    const q = `query Q($id: ID!) { player(id: $id) { biography { overview careerEarnings } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['pga_player'] = j;
  } catch (e) { results['pga_player_error'] = String(e); }

  // 2. PGA Tour: introspect player type to find all fields
  try {
    const q = `{ __type(name: "Player") { fields { name type { name kind } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['pga_Player_fields'] = j?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['pga_player_schema_error'] = String(e); }

  // 3. PGA Tour: playerProfileMajorResults
  try {
    const q = `{ __type(name: "Query") { fields(includeDeprecated: true) { name } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    // Try playerProfileMajorResults
    const hasField = j?.data?.__type?.fields?.some(f => f.name === 'playerProfileMajorResults');
    results['has_majorResults_field'] = hasField;
    if (hasField) {
      const q2 = `query Q($id: ID!) { playerProfileMajorResults(playerId: $id) { year tournamentName position } }`;
      const r2 = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q2, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
      const j2 = await r2.json();
      results['pga_majorResults'] = j2;
    }
  } catch (e) { results['pga_majorResults_error'] = String(e); }

  // 4. PGA Tour playerHub
  try {
    const q2 = `query Q($id: ID!) { playerHub(playerId: $id) { careerEarnings pgaTourWins majorWins pgaTourStarts majorStarts } }`;
    const r2 = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q2, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j2 = await r2.json();
    results['pga_playerHub'] = j2;
  } catch (e) { results['pga_playerHub_error'] = String(e); }

  // 5. ESPN: fetch one season's stats to understand structure (wins, events)
  try {
    const r = await fetch(`${ESPN_CORE}/seasons/2025/types/2/athletes/${espnId}/statistics/0`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json() as Record<string, unknown>;
    results['espn_2025_stats_keys'] = Object.keys(j ?? {});
    results['espn_2025_stats_partial'] = JSON.stringify(j).slice(0, 3000);
  } catch (e) { results['espn_2025_stats_error'] = String(e); }

  // 6. ESPN: fetch 2024 stats
  try {
    const r = await fetch(`${ESPN_CORE}/seasons/2024/types/2/athletes/${espnId}/statistics/0`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json() as Record<string, unknown>;
    results['espn_2024_stats_partial'] = JSON.stringify(j).slice(0, 2000);
  } catch (e) { results['espn_2024_stats_error'] = String(e); }

  return Response.json(results);
}
