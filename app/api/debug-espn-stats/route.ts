export const dynamic = 'force-dynamic';

// Debug endpoint: returns all ESPN Core types/2 stat names+values for a given ESPN player ID.
// Use this to discover the correct stat name for scrambling.
// Example: /api/debug-espn-stats?espnId=4360310 (Scheffler)

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

async function fetchAllCoreStats(espnId: string): Promise<Stat[] | null> {
  const year = new Date().getFullYear();
  const urls = [
    `${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/seasons/${year - 1}/types/2/athletes/${espnId}/statistics/0`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json() as {
        splits?: { categories?: Array<{ stats?: Stat[] }> } | Array<{ stats?: Stat[] }>;
      };
      if (data?.splits && !Array.isArray(data.splits)) {
        const stats = (data.splits as { categories?: Array<{ stats?: Stat[] }> }).categories?.[0]?.stats;
        if (stats?.length) { console.log(`[debug-espn-stats] url=${url} stats=${JSON.stringify(stats)}`); return stats; }
      }
      if (Array.isArray(data?.splits)) {
        const stats = (data.splits as Array<{ stats?: Stat[] }>)[0]?.stats;
        if (stats?.length) { console.log(`[debug-espn-stats] url=${url} stats=${JSON.stringify(stats)}`); return stats; }
      }
    } catch { /* try next */ }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '4360310'; // default: Scheffler
  const stats = await fetchAllCoreStats(espnId);
  if (!stats) return Response.json({ error: 'no data', espnId });
  const result = stats.map((s) => ({
    name: s.name,
    value: s.value,
    displayValue: s.displayValue,
    averageDisplayValue: s.averageDisplayValue,
    average: s.average,
  }));
  console.log(`[debug-espn-stats] espnId=${espnId} statCount=${result.length} names=${result.map(r => r.name).join(',')}`);
  return Response.json({ espnId, statCount: result.length, stats: result });
}
