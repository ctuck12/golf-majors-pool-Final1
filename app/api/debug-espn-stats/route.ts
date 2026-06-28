export const dynamic = 'force-dynamic';

// Debug endpoint: try multiple sources to find scrambling data.
// /api/debug-espn-stats                → run all probes
// /api/debug-espn-stats?pgaId=46046   → use specific PGA Tour ID (Scheffler default)

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

async function tryGql(label: string, query: string, variables: Record<string, unknown>) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(6000),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { label, status: res.status, response: parsed };
  } catch (e) {
    return { label, error: String(e) };
  }
}

async function tryRest(label: string, url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    return { label, url, status: res.status, snippet: text.slice(0, 500), parsed };
  } catch (e) {
    return { label, url, error: String(e) };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaId = searchParams.get('pgaId') ?? '46046'; // Scheffler

  const results = await Promise.all([
    // playerProfileStats — already works, but stats 106/130 were disabled for returning wrong values
    tryGql('playerProfileStats-130-106', `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats { statId value rank }
        }
      }
    `, { playerId: pgaId }),

    // Try alternate GQL query names that might replace statLeaderboard
    tryGql('statsLeaderboard-130', `
      query { statsLeaderboard(statId: "130") { rows { rank displayValue player { firstName lastName } } } }
    `, {}),

    tryGql('statRankings-130', `
      query { statRankings(statId: "130") { rows { rank displayValue player { firstName lastName } } } }
    `, {}),

    tryGql('tourStatsLeaderboard', `
      query { tourStatsLeaderboard { statId statTitle rows { rank displayValue player { firstName lastName } } } }
    `, {}),

    // PGA Tour statdata REST endpoints
    tryRest('statdata-130', 'https://statdata.pgatour.com/r/current/statistics130.json'),
    tryRest('statdata-stat-130', 'https://statdata.pgatour.com/r/current/stat.130.json'),
    tryRest('statdata-2024-130', 'https://statdata.pgatour.com/r/2025/statistics130.json'),
  ]);

  return Response.json({ pgaId, results });
}
