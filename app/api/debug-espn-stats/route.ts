export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaId = searchParams.get('pgaId') ?? '28237'; // Rory default

  const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
  const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
  const headers = { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };

  const d = await fetch(PGA_GQL, {
    method: 'POST', headers,
    body: JSON.stringify({ query: `query Q($id: String!) { playerProfileMajorResults(playerId: $id) { tournaments { year tournamentName position } } }`, variables: { id: pgaId } }),
    signal: AbortSignal.timeout(8000),
  }).then(r => r.json()) as { data?: { playerProfileMajorResults?: { tournaments?: Array<{ year?: unknown; tournamentName?: unknown; position?: unknown }> } }; errors?: unknown[] };

  const tournaments = d?.data?.playerProfileMajorResults?.tournaments ?? [];
  return Response.json({
    pgaId,
    total: tournaments.length,
    allPositions: tournaments.map(t => ({ year: t.year, name: t.tournamentName, position: t.position })),
    wins_eq_1: tournaments.filter(t => String(t.position) === '1').length,
    wins_eq_W: tournaments.filter(t => String(t.position) === 'W').length,
    errors: d?.errors,
  });
}
