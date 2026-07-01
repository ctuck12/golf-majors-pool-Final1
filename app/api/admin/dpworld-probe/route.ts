export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throwaway probe (round 2): keep hunting for a single-call source of the DP World Tour
// "Race to Dubai" season standings. Small number of single requests — no loops, no per-player calls.
// GET /api/admin/dpworld-probe

const CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

async function j(url: string, opts?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000), ...opts });
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return { __nonJson: true, status: res.status, contentType: ct };
    if (!res.ok) return { __httpStatus: res.status };
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}

async function text(url: string, opts?: RequestInit): Promise<{ status: number; len: number; snippet?: string; hasNextData?: boolean; apiHints?: string[] } | { __error: string }> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000), redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; GolfPool/1.0)' }, ...opts });
    const body = await res.text();
    const hasNextData = body.includes('__NEXT_DATA__');
    // Collect distinct-ish API hint URLs referenced in the HTML.
    const hints = Array.from(new Set((body.match(/https?:\/\/[a-z0-9.\-]+\/[a-z0-9\/_\-.]*(?:api|ranking|race)[a-z0-9\/_\-.?=&]*/gi) ?? []))).slice(0, 15);
    return { status: res.status, len: body.length, hasNextData, apiHints: hints };
  } catch (e) { return { __error: String(e) }; }
}

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};

  // 1) List every golf league ESPN tracks (confirm the European Tour code).
  const leagues = await j(`${CORE}?limit=60`) as { items?: Array<{ $ref?: string }> };
  out.leagueRefs = (leagues?.items ?? []).map((i) => i.$ref).filter(Boolean);

  // 2) European Tour: does ESPN even carry its scoreboard? And season 'leaders' for a couple seasons/types.
  out.eurScoreboard = await j(`https://site.api.espn.com/apis/site/v2/sports/golf/eur/scoreboard`).then((d) => {
    const events = (d as { events?: unknown[] })?.events;
    return { eventCount: Array.isArray(events) ? events.length : 0, leaguePresent: !!(d as { leagues?: unknown[] })?.leagues };
  });
  for (const season of ['2025', '2026']) {
    for (const type of ['1', '2']) {
      const d = await j(`${CORE}/eur/seasons/${season}/types/${type}/leaders?limit=3`) as { categories?: Array<{ name?: string; displayName?: string }> };
      out[`eurLeaders_${season}_t${type}`] = (d?.categories ?? []).map((c) => c.name ?? c.displayName) || d;
    }
  }
  // 3) ESPN site standings for eur.
  out.eurStandings = await j(`https://site.web.api.espn.com/apis/v2/sports/golf/eur/standings?season=2026`).then((d) => {
    const std = (d as { standings?: unknown[]; children?: unknown[] });
    return { hasStandings: !!std?.standings, hasChildren: !!std?.children, keys: Object.keys((d as object) ?? {}).slice(0, 10) };
  });

  // 4) DP World Tour official site — does the Race to Dubai page embed the data (Next.js/JSON)?
  out.dpwtRaceToDubai = await text('https://www.dpworldtour.com/race-to-dubai');
  out.dpwtRankings = await text('https://www.dpworldtour.com/dpwt/rankings/race-to-dubai');

  return Response.json(out);
}
