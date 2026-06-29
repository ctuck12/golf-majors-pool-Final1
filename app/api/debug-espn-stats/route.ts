export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '9478';
  const pgaId = searchParams.get('pgaId') ?? '46046';

  const ESPN_ATHLETES = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
  const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
  const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
  const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

  const results: Record<string, unknown> = {};

  // ESPN overview
  try {
    const r = await fetch(`${ESPN_ATHLETES}/${espnId}/overview`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['espn_overview_keys'] = Object.keys(j ?? {});
    const stats = j?.statistics ?? j?.athlete?.statistics;
    if (stats) {
      results['overview_stats_keys'] = Object.keys(stats);
      results['overview_names'] = stats.names;
      results['overview_splits'] = (stats.splits ?? []).map((s: Record<string, unknown>) => ({
        name: s.displayName ?? s.name,
        stats: s.stats,
      }));
    }
    results['overview_raw_partial'] = JSON.stringify(j).slice(0, 3000);
  } catch (e) { results['espn_overview_error'] = String(e); }

  // ESPN Core athlete
  try {
    const r = await fetch(`${ESPN_CORE}/athletes/${espnId}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['core_athlete_keys'] = Object.keys(j ?? {});
    results['core_athlete_partial'] = JSON.stringify(j).slice(0, 2000);
  } catch (e) { results['core_athlete_error'] = String(e); }

  // ESPN Core statistics
  try {
    const r = await fetch(`${ESPN_CORE}/athletes/${espnId}/statistics`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['core_stats_keys'] = Object.keys(j ?? {});
    results['core_stats_partial'] = JSON.stringify(j).slice(0, 3000);
  } catch (e) { results['core_stats_error'] = String(e); }

  // ESPN Core statistics/0 (career)
  try {
    const r = await fetch(`${ESPN_CORE}/athletes/${espnId}/statistics/0`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['core_stats0_partial'] = JSON.stringify(j).slice(0, 3000);
  } catch (e) { results['core_stats0_error'] = String(e); }

  // PGA Tour GQL playerProfile
  try {
    const query = `query Q($id: ID!) { playerProfile(playerId: $id) { playerBio { birthDate height weight college turnedPro pgaTourDebutYear pgaTourWins pgaTourStarts careerEarnings majorWins majorStarts careerWins careerStarts careerMoney } } }`;
    const r = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { id: pgaId } }),
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    results['pga_profile'] = j;
  } catch (e) { results['pga_profile_error'] = String(e); }

  // PGA Tour GQL – introspect playerBio type
  try {
    const query = `{ __type(name: "PlayerBio") { fields { name type { name kind ofType { name } } } } }`;
    const r = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    results['pga_playerBio_schema'] = j?.data?.__type?.fields?.map((f: Record<string, unknown>) => f.name);
  } catch (e) { results['pga_schema_error'] = String(e); }

  return Response.json(results);
}
