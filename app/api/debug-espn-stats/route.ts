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

  // Fetch all position values to see the raw format
  try {
    const d = await post(`query Q($id: String!) { playerProfileMajorResults(playerId: $id) { tournaments { year tournamentName position } } }`, { id: pgaId }) as { data?: { playerProfileMajorResults?: { tournaments?: Array<{ year?: unknown; tournamentName?: unknown; position?: unknown }> } }; errors?: unknown[] };
    results['errors'] = d?.errors;
    const tournaments = d?.data?.playerProfileMajorResults?.tournaments ?? [];
    results['total'] = tournaments.length;
    // Show all positions to see their format
    results['allPositions'] = tournaments.map(t => ({ year: t.year, name: t.tournamentName, position: t.position }));
    // Show just what unique position values look like
    const posValues = [...new Set(tournaments.map(t => String(t.position ?? 'null')))];
    results['uniquePositions'] = posValues;
    results['wins_if_eq_1'] = tournaments.filter(t => String(t.position) === '1').length;
    results['wins_if_eq_W'] = tournaments.filter(t => String(t.position) === 'W').length;
    results['wins_starts_with_1_not_T'] = tournaments.filter(t => { const p = String(t.position ?? ''); return p === '1' || (p.startsWith('1') && !p.startsWith('T1')); }).length;
  } catch (e) { results['err'] = String(e); }

  return Response.json(results);
}
