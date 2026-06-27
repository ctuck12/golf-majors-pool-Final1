export const dynamic = 'force-dynamic';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET() {
  // Search for McNealy ESPN ID
  const searchRes = await fetch(
    'https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=Maverick%20McNealy&limit=10&type=player',
    { cache: 'no-store' }
  );
  const searchData = await searchRes.json();
  const contents = searchData.results?.[0]?.contents ?? [];
  const player = contents.find((c: { uid?: string }) => c.uid?.includes('s:110') && c.uid?.includes('~a:'));
  const espnId = player?.uid?.split('~a:')?.[1] ?? null;

  if (!espnId) return Response.json({ error: 'ESPN ID not found', searchData });

  // ESPN overview
  const overviewRes = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store' });
  const overview = await overviewRes.json();
  const cats = overview?.seasonRankings?.categories ?? [];
  const sandSavesStat = cats.find((s: Record<string, unknown>) => s.name === 'sandSaves') ?? null;

  // ESPN Core stats - try multiple URL formats
  const coreResults: Record<string, unknown> = {};
  const coreUrls = [
    `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2026/athletes/${espnId}/statistics/0`,
    `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2026/athletes/${espnId}/statistics`,
    `https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/athletes/${espnId}/statistics/0`,
  ];
  for (const url of coreUrls) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      coreResults[url] = { status: r.status, topKeys: Object.keys(j ?? {}), splitsType: typeof j?.splits, splitsIsArray: Array.isArray(j?.splits), splitsLen: Array.isArray(j?.splits) ? j.splits.length : (j?.splits?.categories?.length ?? null), raw: j?.splits?.categories?.[0]?.stats?.slice(0, 5) ?? j?.splits?.[0]?.stats?.slice(0, 5) ?? j?.categories?.[0]?.stats?.slice(0, 5) ?? 'no_data' };
    } catch (e) {
      coreResults[url] = { error: String(e) };
    }
  }

  // PGA Tour GQL statLeaderboard for sand saves (stat 107) - try to see if it works
  let pgaStatLbResult: unknown = null;
  try {
    const query = `
      query StatLeaderboard($statId: ID!) {
        statLeaderboard(statId: $statId) {
          rows { rank displayValue player { id firstName lastName } }
        }
      }
    `;
    const lbRes = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId: '107' } }),
      signal: AbortSignal.timeout(5000),
    });
    const lbData = await lbRes.json();
    const rows = lbData?.data?.statLeaderboard?.rows;
    pgaStatLbResult = { status: lbRes.status, rowCount: Array.isArray(rows) ? rows.length : 'not_array', errors: lbData?.errors, first5rows: Array.isArray(rows) ? rows.slice(0, 5) : rows };
  } catch (e) {
    pgaStatLbResult = { error: String(e) };
  }

  // PGA Tour playerProfileStats for McNealy (pgaTourId for McNealy)
  let pgaProfileResult: unknown = null;
  const mcnealyPgaId = '57483';
  try {
    const profileQuery = `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats { statId value displayValue rank }
        }
      }
    `;
    const profileRes = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query: profileQuery, variables: { playerId: mcnealyPgaId } }),
      signal: AbortSignal.timeout(5000),
    });
    const profileData = await profileRes.json();
    const groups = profileData?.data?.playerProfileStats ?? [];
    const allStats = Array.isArray(groups) ? groups.flatMap((g: { stats?: unknown[] }) => g.stats ?? []) : [];
    const stat107 = allStats.find((s: { statId?: string }) => s.statId === '107');
    const stat111 = allStats.find((s: { statId?: string }) => s.statId === '111');
    pgaProfileResult = { status: profileRes.status, stat107, stat111, statCount: allStats.length, errors: profileData?.errors };
  } catch (e) {
    pgaProfileResult = { error: String(e) };
  }

  return Response.json({
    espnId,
    sandSavesStat,
    coreResults,
    pgaStatLbResult,
    pgaProfileResult,
  });
}
