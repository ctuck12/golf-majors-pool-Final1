export const dynamic = 'force-dynamic';

async function tryFetch(label: string, url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...init });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text.slice(0, 500); }
    return { label, status: res.status, ok: res.ok, url, data: json };
  } catch (e) {
    return { label, error: String(e), url };
  }
}

export async function GET() {
  const results = await Promise.all([
    // ESPN rankings index for golf
    tryFetch('espn-rankings-index', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings?limit=20'),
    // ESPN rankings 1-8
    tryFetch('espn-ranking-1', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/1'),
    tryFetch('espn-ranking-2', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/2'),
    tryFetch('espn-ranking-3', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/3'),
    tryFetch('espn-ranking-4', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/4'),
    tryFetch('espn-ranking-5', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/5'),
    tryFetch('espn-ranking-6', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/6'),
    tryFetch('espn-ranking-7', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/7'),
    tryFetch('espn-ranking-8', 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings/8'),
    // DP World Tour / European Tour official API attempts
    tryFetch('dpworld-rankings-page', 'https://www.europeantour.com/dpworld-tour/rankings/race-to-dubai/'),
    tryFetch('dpworld-api-v1', 'https://api.europeantour.com/api/sportdata/RaceToDubai/Ranking?$top=200'),
    tryFetch('dpworld-cms', 'https://www.europeantour.com/api/rankings/race-to-dubai?year=2026&limit=100'),
    tryFetch('dpworld-tour-api', 'https://www.dpworldtour.com/api/rankings'),
    // DataGolf (free tier)
    tryFetch('datagolf-rankings', 'https://feeds.datagolf.com/preds/get-dg-rankings?file_format=json&key='),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
