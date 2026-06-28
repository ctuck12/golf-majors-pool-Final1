export const dynamic = 'force-dynamic';

// Debug endpoint: fetch a working player ID from the major events pool,
// then show ALL stat names from their ESPN overview.
// /api/debug-espn-stats?espnId=4360310  → use specific ID
// /api/debug-espn-stats                 → auto-pick first working player from pool

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_EVENT_IDS = ['401811952', '401811947', '401811941'];

type Stat = { name?: string; value?: number; displayValue?: string; averageDisplayValue?: string; average?: number };

async function getPoolIds(): Promise<string[]> {
  const idSet = new Set<string>();
  await Promise.all(PGA_EVENT_IDS.map(async (eventId) => {
    try {
      const res = await fetch(
        `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`,
        { cache: 'no-store', signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return;
      const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
      for (const item of data.items ?? []) {
        const id = item.id ?? item.$ref?.match(/competitors\/(\d+)/)?.[1];
        if (id) idSet.add(id);
      }
    } catch { /* ignore */ }
  }));
  return Array.from(idSet);
}

async function getOverviewStats(espnId: string): Promise<{ stats: Stat[]; error?: string } | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { stats: [], error: `${res.status}` };
    const data = await res.json() as { seasonRankings?: { categories?: Stat[] }; summaryStatistics?: Stat[] };
    const cats = data?.seasonRankings?.categories ?? [];
    const summary = data?.summaryStatistics ?? [];
    return { stats: [...cats, ...summary] };
  } catch (e) {
    return { stats: [], error: String(e) };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixedId = searchParams.get('espnId');

  if (fixedId) {
    const result = await getOverviewStats(fixedId);
    return Response.json({ espnId: fixedId, ...result });
  }

  // Auto-pick: try pool IDs until we find one whose overview works
  const ids = await getPoolIds();
  const results: Array<{ espnId: string; statCount: number; error?: string; stats?: Stat[] }> = [];

  for (const id of ids.slice(0, 20)) {
    const result = await getOverviewStats(id);
    if (result && result.stats.length > 0) {
      return Response.json({
        espnId: id,
        totalPoolIds: ids.length,
        statCount: result.stats.length,
        stats: result.stats.map((s) => ({
          name: s.name,
          value: s.value,
          displayValue: s.displayValue,
          averageDisplayValue: s.averageDisplayValue,
          average: s.average,
        })),
      });
    }
    results.push({ espnId: id, statCount: 0, error: result?.error });
  }

  return Response.json({ error: 'no working overview found in first 20 pool IDs', tried: results });
}
