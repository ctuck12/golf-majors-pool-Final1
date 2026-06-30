export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

async function summed(id: string, tourCode: string) {
  const q = `query R($id: ID!){ playerProfileTournamentResults(playerId: $id, tourCode: ${tourCode}){ tournaments { overviewInfo { events wins money } } } }`;
  const r = await gql(q, { id }) as { data?: { playerProfileTournamentResults?: { tournaments?: Array<{ overviewInfo?: { events?: number; wins?: number; money?: number } }> } }; errors?: Array<{ message?: string }> };
  if (r?.errors?.length) return { tourCode, error: r.errors[0]?.message?.slice(0, 120) };
  const groups = r?.data?.playerProfileTournamentResults?.tournaments ?? [];
  let events = 0, wins = 0, money = 0;
  for (const g of groups) { const o = g.overviewInfo; if (!o) continue; events += o.events ?? 0; wins += o.wins ?? 0; money += o.money ?? 0; }
  return { tourCode, groups: groups.length, events, wins, money };
}

export async function GET() {
  const tourCodes = await gql(`{ __type(name:"TourCode"){ enumValues { name } } }`);
  // Matt Fitzpatrick (40098) and Robert MacIntyre (52215) both play heavily on the DP World Tour.
  const guesses = ['R', 'E', 'EUR', 'DPWT', 'ET', 'EPGA'];
  const fitz = await Promise.all(guesses.map((tc) => summed('40098', tc)));
  const macintyre = await Promise.all(guesses.map((tc) => summed('52215', tc)));
  return Response.json({ tourCodes, fitzpatrick_40098: fitz, macintyre_52215: macintyre });
}
