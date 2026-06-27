export const dynamic = 'force-dynamic';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_SITE = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET() {
  const espnId = '9530'; // McNealy
  const mcnealyPgaId = '57483';
  const year = 2026;

  // 1. Try additional ESPN Core URL patterns (with types/2 = regular season)
  const coreUrls = [
    `${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics`,
    `${ESPN_CORE}/seasons/${year - 1}/types/2/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/seasons/${year}/athletes/${espnId}/statistics/0?lang=en&region=us`,
  ];
  const coreResults: Record<string, unknown> = {};
  for (const url of coreUrls) {
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      const j = await r.json();
      const cats = j?.splits?.categories ?? j?.categories ?? [];
      const stats: Array<{ name?: string; displayValue?: string; value?: number; averageDisplayValue?: string }> = Array.isArray(cats) && cats[0]?.stats ? cats[0].stats : [];
      const sandSavesStat = stats.find((s) => /sand/i.test(s.name ?? ''));
      coreResults[url] = {
        status: r.status,
        topKeys: Object.keys(j ?? {}),
        statsCount: stats.length,
        sandSavesStat,
        first3Stats: stats.slice(0, 3),
      };
    } catch (e) {
      coreResults[url] = { error: String(e) };
    }
  }

  // 2. Try ESPN site API stats endpoint
  const siteUrls = [
    `${ESPN_SITE}/${espnId}/stats`,
    `${ESPN_SITE}/${espnId}/gamelog`,
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}/statistics`,
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/athletes/${espnId}/stats`,
  ];
  const siteResults: Record<string, unknown> = {};
  for (const url of siteUrls) {
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      const j = await r.json();
      siteResults[url] = { status: r.status, topKeys: Object.keys(j ?? {}) };
    } catch (e) {
      siteResults[url] = { error: String(e) };
    }
  }

  // 3. PGA playerProfileStats: statId/value/rank only — show all 13 stats
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
    const allStats: Array<{ statId?: string; value?: number; rank?: unknown }> = Array.isArray(groups)
      ? groups.flatMap((g: { stats?: Array<{ statId?: string; value?: number; rank?: unknown }> }) => g.stats ?? [])
      : [];
    pgaStatsResult = {
      status: res.status,
      statCount: allStats.length,
      allStatIds: allStats.map((s) => ({ statId: s.statId, value: s.value, rank: s.rank })),
      errors: data?.errors,
    };
  } catch (e) {
    pgaStatsResult = { error: String(e) };
  }

  return Response.json({ espnId, coreResults, siteResults, pgaStatsResult });
}
