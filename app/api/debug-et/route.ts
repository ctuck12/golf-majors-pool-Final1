export const dynamic = 'force-dynamic';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': PGA_API_KEY,
  'Referer': 'https://www.pgatour.com/',
  'Origin': 'https://www.pgatour.com',
};

async function probe(url: string, opts?: RequestInit): Promise<{ url: string; status: number; preview: string }> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(7000) });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, preview: text.slice(0, 600) };
  } catch (e) {
    return { url, status: 0, preview: String(e) };
  }
}

async function gql(query: string) {
  return probe(PGA_GQL, { method: 'POST', headers: GQL_HEADERS, body: JSON.stringify({ query }) });
}

export async function GET() {
  const results = await Promise.all([
    // Dump full current tourCup standings (all 20 players with IDs and names)
    gql(`{ tourCup(id: "R-2700-2026") { rankings { ... on CupRankingPlayer { position id name total } } } }`),

    // OWGR API patterns
    probe('https://www.owgr.com/api/ranking?tour=EDPW&year=2026&pageNo=1&pageSize=50', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
    probe('https://www.owgr.com/api/stats/ranking?tour=EDPW&year=2026', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),

    // Sofascore golf European Tour
    probe('https://api.sofascore.com/api/v1/unique-tournament/995/seasons', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
    probe('https://api.sofascore.com/api/v1/unique-tournament/1013/standings/total', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),

    // Golf Channel / Golf.com
    probe('https://www.golfchannel.com/api/tour-standings?tour=euro&season=2026', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
  ]);

  return Response.json(results);
}
