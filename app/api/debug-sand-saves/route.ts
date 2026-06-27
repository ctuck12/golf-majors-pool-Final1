export const dynamic = 'force-dynamic';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET() {
  const espnId = '9530'; // McNealy
  const mcnealyPgaId = '57483';

  // 1. Overview: show statistics.names and splits for sand saves
  let overviewStats: unknown = null;
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store' });
    const data = await res.json();
    const names = data?.statistics?.names ?? [];
    const splits = data?.statistics?.splits ?? [];
    const pgaSplit = splits.find((s: { displayName?: string }) => s.displayName?.includes('PGA')) ?? splits[0] ?? null;
    const sandSaveIdx = names.findIndex((n: string) => /sand save/i.test(n));
    overviewStats = {
      statsNamesCount: names.length,
      splitsCount: splits.length,
      pgaSplitDisplayName: pgaSplit?.displayName ?? null,
      pgaSplitStatsCount: pgaSplit?.stats?.length ?? 0,
      sandSaveNameIdx: sandSaveIdx,
      sandSaveNameMatch: sandSaveIdx >= 0 ? names[sandSaveIdx] : null,
      sandSaveValue: sandSaveIdx >= 0 && pgaSplit ? pgaSplit.stats[sandSaveIdx] : null,
      allNames: names.slice(0, 30),
      seasonRankingsSandSaves: (data?.seasonRankings?.categories ?? []).find((c: { name?: string }) => c.name === 'sandSaves') ?? null,
    };
  } catch (e) {
    overviewStats = { error: String(e) };
  }

  // 2. ESPN Core: test year-1 (2025) since 2026 returns 404
  const coreUrls = [
    `${ESPN_CORE}/seasons/2025/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/seasons/2025/athletes/${espnId}/statistics`,
    `${ESPN_CORE}/athletes/${espnId}/statistics`,
  ];
  const coreResults: Record<string, unknown> = {};
  for (const url of coreUrls) {
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      const j = await r.json();
      const cats = j?.splits?.categories ?? j?.categories ?? [];
      const stats = Array.isArray(cats) ? cats[0]?.stats ?? [] : [];
      const sandSavesStat = Array.isArray(stats) ? stats.find((s: { name?: string }) => /sand/i.test(s.name ?? '')) : null;
      coreResults[url] = {
        status: r.status,
        topKeys: Object.keys(j ?? {}),
        statsCount: stats.length,
        sandSavesStat,
        first3Stats: Array.isArray(stats) ? stats.slice(0, 3) : [],
      };
    } catch (e) {
      coreResults[url] = { error: String(e) };
    }
  }

  // 3. PGA playerProfileStats: ONLY statId/value/rank (no displayValue) — show stat 107 and 111
  let pgaStatsResult: unknown = null;
  try {
    const query = `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats { statId value rank }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { playerId: mcnealyPgaId } }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const groups = data?.data?.playerProfileStats ?? [];
    const allStats: Array<{ statId?: string; value?: unknown; rank?: unknown }> = Array.isArray(groups)
      ? groups.flatMap((g: { stats?: Array<{ statId?: string; value?: unknown; rank?: unknown }> }) => g.stats ?? [])
      : [];
    const stat107 = allStats.find((s) => s.statId === '107');
    const stat111 = allStats.find((s) => s.statId === '111');
    pgaStatsResult = {
      status: res.status,
      statCount: allStats.length,
      stat107,
      stat111,
      errors: data?.errors,
    };
  } catch (e) {
    pgaStatsResult = { error: String(e) };
  }

  return Response.json({ espnId, overviewStats, coreResults, pgaStatsResult });
}
