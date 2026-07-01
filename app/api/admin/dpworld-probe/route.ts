export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throwaway probe: find an ESPN endpoint that returns the full DP World Tour (European Tour)
// "Race to Dubai" season standings in ONE call, so the DP World bubble can auto-update like OWGR
// and FedEx already do. Makes only a small number of single requests — no loops, no per-player calls.
// GET /api/admin/dpworld-probe

const CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

async function j(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
    if (!res.ok) return { __httpStatus: res.status, url };
    return await res.json();
  } catch (e) { return { __error: String(e), url }; }
}

export async function GET(request: Request) {
  const season = new URL(request.url).searchParams.get('season') ?? '2026';
  const out: Record<string, unknown> = { season };

  // 1) Enumerate the 'all'-league rankings collection (OWGR lives here as type 1 — is Race to Dubai here too?)
  const allRankings = await j(`${CORE}/all/seasons/${season}/rankings`) as { items?: Array<{ $ref?: string }>; count?: number };
  const allRankingRefs = (allRankings?.items ?? []).map((i) => i.$ref).filter(Boolean).slice(0, 12);
  // Fetch the name of each ranking type so we can spot a Race to Dubai / European list.
  out.allRankingTypes = await Promise.all(allRankingRefs.map(async (ref) => {
    const d = await j(ref as string) as { id?: string; name?: string; shortName?: string; type?: string };
    return { id: d?.id, name: d?.name, shortName: d?.shortName, type: d?.type };
  }));

  // 2) European Tour (eur) league: season 'leaders' categories (FedEx uses the analogous pga endpoint).
  const eurLeaders = await j(`${CORE}/eur/seasons/${season}/types/2/leaders?limit=5`) as { categories?: Array<{ name?: string; displayName?: string; leaders?: unknown[] }> };
  out.eurLeaderCategories = (eurLeaders?.categories ?? []).map((c) => ({
    name: c.name, displayName: c.displayName, leaderCount: Array.isArray(c.leaders) ? c.leaders.length : 0,
  }));

  // 3) eur league rankings collection (some tours expose the order-of-merit as a ranking type).
  const eurRankings = await j(`${CORE}/eur/seasons/${season}/rankings`) as { items?: Array<{ $ref?: string }>; count?: number };
  const eurRankingRefs = (eurRankings?.items ?? []).map((i) => i.$ref).filter(Boolean).slice(0, 12);
  out.eurRankingTypes = await Promise.all(eurRankingRefs.map(async (ref) => {
    const d = await j(ref as string) as { id?: string; name?: string; shortName?: string };
    return { id: d?.id, name: d?.name, shortName: d?.shortName };
  }));
  out.eurRankingsCount = eurRankings?.count ?? 0;
  out.allRankingsCount = allRankings?.count ?? 0;

  return Response.json(out);
}
