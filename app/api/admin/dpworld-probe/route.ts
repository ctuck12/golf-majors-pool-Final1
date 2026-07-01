export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throwaway probe (round 3): fast, parallel. ESPN checks by default; add ?site=1 to also scrape the
// DP World Tour site (slower). Small number of single requests — no loops, no per-player calls.
// GET /api/admin/dpworld-probe          -> ESPN checks
// GET /api/admin/dpworld-probe?site=1   -> DP World Tour site HTML inspection

const CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

async function j(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return { __nonJson: true, status: res.status };
    if (!res.ok) return { __httpStatus: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e).slice(0, 120) }; }
}

async function siteText(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000), redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; GolfPool/1.0)' } });
    const body = await res.text();
    const hints = Array.from(new Set((body.match(/https?:\/\/[a-z0-9.\-]+\/[a-z0-9\/_\-.]*(?:api|ranking|race-to-dubai|sportdata)[a-z0-9\/_\-.?=&]*/gi) ?? []))).slice(0, 20);
    return { status: res.status, len: body.length, hasNextData: body.includes('__NEXT_DATA__'), mentionsRaceToDubai: /race to dubai/i.test(body), apiHints: hints };
  } catch (e) { return { __error: String(e).slice(0, 160) }; }
}

export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get('site') === '1';

  if (site) {
    const [a, b] = await Promise.all([
      siteText('https://www.dpworldtour.com/race-to-dubai'),
      siteText('https://www.dpworldtour.com/dpwt/rankings/race-to-dubai'),
    ]);
    return Response.json({ dpwtRaceToDubai: a, dpwtRankings: b });
  }

  const [leagues, eurSb, e25t1, e25t2, e26t1, e26t2, eurStd] = await Promise.all([
    j(`${CORE}?limit=60`),
    j(`https://site.api.espn.com/apis/site/v2/sports/golf/eur/scoreboard`),
    j(`${CORE}/eur/seasons/2025/types/1/leaders?limit=3`),
    j(`${CORE}/eur/seasons/2025/types/2/leaders?limit=3`),
    j(`${CORE}/eur/seasons/2026/types/1/leaders?limit=3`),
    j(`${CORE}/eur/seasons/2026/types/2/leaders?limit=3`),
    j(`https://site.web.api.espn.com/apis/v2/sports/golf/eur/standings?season=2026`),
  ]);

  const cats = (d: unknown) => (d as { categories?: Array<{ name?: string; displayName?: string }> })?.categories?.map((c) => c.name ?? c.displayName) ?? d;
  const sb = eurSb as { events?: unknown[]; leagues?: Array<{ name?: string }> };

  return Response.json({
    leagueRefs: (leagues as { items?: Array<{ $ref?: string }> })?.items?.map((i) => i.$ref) ?? leagues,
    eurScoreboard: { eventCount: Array.isArray(sb?.events) ? sb.events.length : 0, leagueName: sb?.leagues?.[0]?.name ?? null },
    eurLeaders_2025_t1: cats(e25t1),
    eurLeaders_2025_t2: cats(e25t2),
    eurLeaders_2026_t1: cats(e26t1),
    eurLeaders_2026_t2: cats(e26t2),
    eurStandings_keys: Object.keys((eurStd as object) ?? {}).slice(0, 12),
  });
}
