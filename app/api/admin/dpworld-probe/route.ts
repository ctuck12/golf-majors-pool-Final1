export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Throwaway probe (round 4): drill into the ESPN DP World Tour standings structure to confirm it is
// the Race to Dubai list and learn how to read player name + rank. One request.
// GET /api/admin/dpworld-probe?season=2026

export async function GET(request: Request) {
  const season = new URL(request.url).searchParams.get('season') ?? '2026';
  try {
    const res = await fetch(`https://site.web.api.espn.com/apis/v2/sports/golf/eur/standings?season=${season}`, {
      cache: 'no-store', signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return Response.json({ __httpStatus: res.status });
    const data = await res.json() as {
      season?: unknown;
      children?: Array<{
        name?: string; displayName?: string; abbreviation?: string;
        standings?: { name?: string; entries?: Array<{
          athlete?: { displayName?: string; id?: string };
          stats?: Array<{ name?: string; displayName?: string; type?: string; value?: number; displayValue?: string }>;
        }> };
      }>;
    };

    const children = data.children ?? [];
    const summary = children.map((c) => ({
      name: c.name ?? c.displayName ?? c.abbreviation,
      standingsName: c.standings?.name,
      entryCount: c.standings?.entries?.length ?? 0,
      // Stat columns available on the first entry (so we can see if 'rank' / 'points' exist)
      statColumns: (c.standings?.entries?.[0]?.stats ?? []).map((s) => ({ name: s.name, type: s.type, displayName: s.displayName })),
      // First 5 entries: name + all stats, so we can see rank + points values
      sampleEntries: (c.standings?.entries ?? []).slice(0, 5).map((e) => ({
        name: e.athlete?.displayName,
        id: e.athlete?.id,
        stats: (e.stats ?? []).map((s) => ({ n: s.name ?? s.type, v: s.value, d: s.displayValue })),
      })),
    }));

    return Response.json({ season, childrenCount: children.length, seasonInfo: data.season, groups: summary });
  } catch (e) {
    return Response.json({ __error: String(e).slice(0, 200) });
  }
}
