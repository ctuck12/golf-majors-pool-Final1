export const dynamic = 'force-dynamic';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournId = searchParams.get('tournId') ?? 'R2026033'; // PGA Championship default
  const playerId = searchParams.get('playerId') ?? '46046';  // Scheffler default

  const query = `
    query ScorecardDebug($id: ID!, $playerId: ID!) {
      scorecardStatsV3(id: $id, playerId: $playerId) {
        rounds {
          round
          displayName
          performance { statId total rank }
          strokesGained { statId label total rank }
        }
      }
    }
  `;

  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/',
        'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables: { id: tournId, playerId } }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return Response.json({ tournId, playerId, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: String(e) });
  }
}
