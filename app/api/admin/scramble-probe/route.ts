export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throwaway probe: verify the PGA leaderboardV2 field shape (player ids + cut status) so we can
// build a FULL-FIELD scrambling leaderboard (statDetails EVENT_ONLY only returns made-cut players).
// GET /api/admin/scramble-probe?id=R2026033

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function headers() {
  return { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ?? 'R2026033';

  const out: Record<string, unknown> = { id };

  // Probe leaderboardV2 for the field with player ids + status
  const lbQuery = `
    query LB($id: ID!) {
      leaderboardV2(id: $id) {
        players {
          ... on PlayerRowV2 {
            id
            scoringData { position total playerState }
            player { id displayName }
          }
        }
      }
    }
  `;
  try {
    const res = await fetch(PGA_GQL, { method: 'POST', headers: headers(), body: JSON.stringify({ query: lbQuery, variables: { id } }), signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    if (json.errors) out.lbErrors = json.errors;
    const players = json?.data?.leaderboardV2?.players ?? [];
    out.lbCount = players.length;
    out.lbSample = players.slice(0, 5);
    // Tally distinct playerState values
    const states: Record<string, number> = {};
    for (const p of players) {
      const st = p?.scoringData?.playerState ?? p?.scoringData?.position ?? 'unknown';
      states[String(st)] = (states[String(st)] ?? 0) + 1;
    }
    out.stateTally = states;
  } catch (e) {
    out.lbError = String(e);
  }

  return Response.json(out);
}
