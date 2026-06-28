export const dynamic = 'force-dynamic';

// Debug endpoint: returns raw ESPN Core types/2 response for a given ESPN player ID.
// Example: /api/debug-espn-stats?espnId=4360310 (Scheffler)

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

type Stat = { name?: string; value?: number; displayValue?: string; averageDisplayValue?: string };
type StatEntry = { status: number; hasStats?: boolean; statCount?: number; stats?: Stat[] | null; rawSnippet?: string; error?: string };

function extractStats(data: unknown): Stat[] | null {
  const d = data as { splits?: unknown };
  if (d?.splits && !Array.isArray(d.splits)) {
    return (d.splits as { categories?: Array<{ stats?: Stat[] }> }).categories?.[0]?.stats ?? null;
  }
  if (Array.isArray(d?.splits)) {
    return (d.splits as Array<{ stats?: Stat[] }>)[0]?.stats ?? null;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '4360310';
  const year = new Date().getFullYear();

  const results: Record<string, StatEntry> = {};

  for (const yr of [year, year - 1]) {
    for (const type of ['2', '1']) {
      const url = `${ESPN_CORE}/seasons/${yr}/types/${type}/athletes/${espnId}/statistics/0`;
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        const text = await res.text();
        const key = `${yr}/type${type}`;
        if (!res.ok) {
          results[key] = { status: res.status, error: text.slice(0, 200) };
          continue;
        }
        let parsed: unknown = null;
        try { parsed = JSON.parse(text); } catch { /* not json */ }
        const stats = extractStats(parsed);
        results[key] = {
          status: res.status,
          hasStats: !!stats,
          statCount: stats?.length ?? 0,
          stats: stats?.map((s) => ({ name: s.name, value: s.value, displayValue: s.displayValue, averageDisplayValue: s.averageDisplayValue })) ?? null,
          rawSnippet: !stats ? text.slice(0, 500) : undefined,
        };
      } catch (e) {
        results[`${yr}/type${type}`] = { status: 0, error: String(e) };
      }
    }
  }

  return Response.json({ espnId, results });
}
