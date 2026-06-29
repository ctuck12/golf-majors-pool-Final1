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

  // 1. Introspect nested types in PlayerProfileMajors
  for (const typeName of ['PlayerProfileMajorsTournament', 'PlayerProfileMajorsTimeline', 'PlayerProfileMajorsTimelineTournament']) {
    try {
      const q = `{ __type(name: "${typeName}") { fields { name type { name kind } } } }`;
      const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(6000) });
      const j = await r.json() as { data?: { __type?: { fields?: Array<{ name: string }> } | null } };
      results[`${typeName}_fields`] = j?.data?.__type?.fields?.map(f => f.name) ?? null;
    } catch (e) { results[`${typeName}_error`] = String(e); }
  }

  // 2. Try querying playerProfileMajorResults with only known valid fields
  try {
    const q = `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { playerId tournaments timelineHeaders timelineTournaments } }`;
    const r = await fetch(PGA_GQL, { method: 'POST', headers: gqlHeaders, body: JSON.stringify({ query: q, variables: { id: pgaId } }), signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    results['pga_majorResults_raw'] = j;
  } catch (e) { results['majorResults_raw_error'] = String(e); }

  // 3. ESPN career totals by summing season stats — fetch all seasons in parallel
  try {
    const logRes = await fetch(`${ESPN_CORE}/athletes/${espnId}/statisticslog`, { signal: AbortSignal.timeout(6000) });
    const logData = await logRes.json() as { entries?: Array<{ statistics?: Array<{ statistics?: { $ref?: string } }> }> };
    const urls = (logData.entries ?? [])
      .flatMap(e => e.statistics ?? [])
      .map(s => s.statistics?.$ref)
      .filter((u): u is string => !!u);

    const seasonStats = await Promise.allSettled(
      urls.map(async (url) => {
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const d = await r.json() as { splits?: { categories?: Array<{ stats?: Array<{ name: string; value?: number }> }> } };
        const stats: Record<string, number> = {};
        for (const cat of d.splits?.categories ?? []) {
          for (const s of cat.stats ?? []) {
            if (s.value != null) stats[s.name] = s.value;
          }
        }
        return stats;
      })
    );

    let totalStarts = 0, totalWins = 0, totalEarnings = 0;
    for (const r of seasonStats) {
      if (r.status === 'fulfilled') {
        totalStarts += r.value.tournamentsPlayed ?? 0;
        totalWins += r.value.wins ?? 0;
        totalEarnings += r.value.officialAmount ?? r.value.amount ?? 0;
      }
    }
    results['career_totals'] = { totalStarts, totalWins, totalEarnings: Math.round(totalEarnings), seasons: urls.length };
  } catch (e) { results['career_totals_error'] = String(e); }

  return Response.json(results);
}
