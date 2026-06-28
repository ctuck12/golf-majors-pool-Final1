export const dynamic = 'force-dynamic';

// Debug endpoint: raw PGA Tour GQL statLeaderboard response for a given stat ID.
// Example: /api/debug-espn-stats?statId=130 (scrambling)
// Other useful IDs: 111 (sand saves), 106 (scrambling alt), 101 (driving dist)

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statId = searchParams.get('statId') ?? '130';

  try {
    const query = `
      query StatLeaderboard($statId: ID!) {
        statLeaderboard(statId: $statId) {
          rows { rank displayValue player { firstName lastName } }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/',
        'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables: { statId } }),
      signal: AbortSignal.timeout(8000),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }

    return Response.json({ statId, status: res.status, response: parsed, rawSnippet: text.slice(0, 1000) });
  } catch (e) {
    return Response.json({ statId, error: String(e) });
  }
}
