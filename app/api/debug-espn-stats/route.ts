export const dynamic = 'force-dynamic';

// Debug endpoint: returns ESPN overview stats for a given ESPN player ID.
// Example: /api/debug-espn-stats?espnId=4360310 (Scheffler)

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';

type Stat = { name?: string; value?: number; displayValue?: string; averageDisplayValue?: string; average?: number };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '4360310';

  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return Response.json({ espnId, error: `overview ${res.status}` });
    const data = await res.json() as {
      seasonRankings?: { categories?: Stat[] };
      summaryStatistics?: Stat[];
    };

    const cats = data?.seasonRankings?.categories ?? [];
    const summary = data?.summaryStatistics ?? [];
    const all = [...cats, ...summary];

    const mapped = all.map((s) => ({
      name: s.name,
      value: s.value,
      displayValue: s.displayValue,
      averageDisplayValue: s.averageDisplayValue,
      average: s.average,
    }));

    return Response.json({ espnId, statCount: mapped.length, stats: mapped });
  } catch (e) {
    return Response.json({ espnId, error: String(e) });
  }
}
