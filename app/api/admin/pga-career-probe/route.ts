export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function gql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

export async function GET() {
  const q = `query R($id: ID!){ playerProfileTournamentResults(playerId: $id, tourCode: R){ tournaments { overviewInfo { events wins money cutsMade top10 } } } }`;

  async function summed(id: string) {
    const r = await gql(q, { id }) as { data?: { playerProfileTournamentResults?: { tournaments?: Array<{ overviewInfo?: { events?: number; wins?: number; money?: number; cutsMade?: number; top10?: number } }> } }; errors?: unknown[] };
    if (r?.errors?.length) return { errors: r.errors };
    const groups = r?.data?.playerProfileTournamentResults?.tournaments ?? [];
    let events = 0, wins = 0, money = 0, cutsMade = 0, top10 = 0;
    for (const g of groups) {
      const o = g.overviewInfo; if (!o) continue;
      events += o.events ?? 0; wins += o.wins ?? 0; money += o.money ?? 0;
      cutsMade += o.cutsMade ?? 0; top10 += o.top10 ?? 0;
    }
    return { groupCount: groups.length, events, wins, money, cutsMade, top10 };
  }

  return Response.json({
    jaydenSchaper_57737: await summed('57737'),
    scottieScheffler_46046: await summed('46046'),
  });
}
