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

  const lbQuery = `
    query LB($id: ID!) {
      leaderboardV2(id: $id) {
        players {
          ... on PlayerRowV2 {
            position
            playerState
            player { id displayName }
          }
        }
      }
    }
  `;
  type Row = { position?: string; playerState?: string; player?: { id?: string; displayName?: string } };
  let rows: Row[] = [];
  try {
    const res = await fetch(PGA_GQL, { method: 'POST', headers: headers(), body: JSON.stringify({ query: lbQuery, variables: { id } }), signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    if (json.errors) out.lbErrors = json.errors;
    rows = json?.data?.leaderboardV2?.players ?? [];
  } catch (e) { out.lbError = String(e); }

  out.fieldCount = rows.length;
  const stateTally: Record<string, number> = {};
  for (const r of rows) { const k = String(r.playerState ?? 'null'); stateTally[k] = (stateTally[k] ?? 0) + 1; }
  out.stateTally = stateTally;
  const posTally: Record<string, number> = {};
  for (const r of rows) { const k = String(r.position ?? 'null'); if (/cut|wd|dq|mdf/i.test(k)) posTally[k] = (posTally[k] ?? 0) + 1; }
  out.cutPositionTally = posTally;

  // Pick 3 cut players and fetch their scorecard scrambling (statId 130) to confirm it works.
  const cutRows = rows.filter((r) => /cut|mdf|wd/i.test(String(r.position ?? '')) || /cut|withdrawn/i.test(String(r.playerState ?? ''))).slice(0, 3);
  const scQuery = `query SC($id: ID!, $playerId: ID!) { scorecardStatsV3(id: $id, playerId: $playerId) { rounds { round performance { statId total } } } }`;
  out.cutSample = await Promise.all(cutRows.map(async (r) => {
    try {
      const res = await fetch(PGA_GQL, { method: 'POST', headers: headers(), body: JSON.stringify({ query: scQuery, variables: { id, playerId: r.player?.id } }), signal: AbortSignal.timeout(10000) });
      const json = await res.json();
      const rounds = json?.data?.scorecardStatsV3?.rounds ?? [];
      const all = rounds.find((x: { round?: string }) => x.round === '-1') ?? rounds[rounds.length - 1];
      const scr = (all?.performance ?? []).find((p: { statId?: string }) => p.statId === '130');
      return { name: r.player?.displayName, playerId: r.player?.id, position: r.position, scrambling: scr?.total ?? null };
    } catch (e) { return { name: r.player?.displayName, error: String(e) }; }
  }));

  return Response.json(out);
}
