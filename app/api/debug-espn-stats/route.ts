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

  // 1. Introspect PlayerProfileMajors type to find real field names
  try {
    const q = `{ __type(name: "PlayerProfileMajors") { fields { name type { name kind } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['PlayerProfileMajors_fields'] = j?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['majors_schema_error'] = String(e); }

  // 2. Try playerProfileMajorResults with String! variable and introspected fields
  try {
    const q = `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { tournamentId displayYear finish } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['pga_majorResults_v2'] = j;
  } catch (e) { results['majorResults_v2_error'] = String(e); }

  // 3. Try playerProfileTournamentResults to understand its schema
  try {
    const q = `{ __type(name: "PlayerProfileTournament") { fields { name type { name kind } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['PlayerProfileTournament_fields'] = j?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['tournament_schema_error'] = String(e); }

  // 4. Get full ESPN 2025 stats — all categories to find wins+earnings
  try {
    const r = await fetch(`${ESPN_CORE}/seasons/2025/types/2/athletes/${espnId}/statistics/0`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { splits?: { categories?: Array<{ name: string; stats?: Array<{ name: string; value?: number; displayValue?: string }> }> } };
    // Extract all stat names and values across all categories
    const allStats: Record<string, unknown>[] = [];
    for (const cat of j?.splits?.categories ?? []) {
      for (const s of cat.stats ?? []) {
        if (s.value != null || s.displayValue) {
          allStats.push({ cat: cat.name, name: s.name, value: s.value, display: s.displayValue });
        }
      }
    }
    results['espn_2025_all_stats'] = allStats;
  } catch (e) { results['espn_2025_full_error'] = String(e); }

  // 5. playerProfileStats schema — does it have career fields?
  try {
    const q = `{ __type(name: "PlayerProfileStat") { fields { name type { name kind } } } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
    const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } } };
    results['PlayerProfileStat_fields'] = j?.data?.__type?.fields?.map(f => f.name);
  } catch (e) { results['profileStat_schema_error'] = String(e); }

  return Response.json(results);
}
