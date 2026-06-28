export const dynamic = 'force-dynamic';

// Debug endpoint: returns raw ESPN Core types/2 response for a given ESPN player ID.
// Example: /api/debug-espn-stats?espnId=4360310 (Scheffler)

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '4360310';
  const year = new Date().getFullYear();

  const results: Record<string, unknown> = {};

  for (const yr of [year, year - 1]) {
    for (const type of ['2', '1']) {
      const url = `${ESPN_CORE}/seasons/${yr}/types/${type}/athletes/${espnId}/statistics/0`;
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = JSON.parse(text); } catch { /* not json */ }
        const key = `${yr}/type${type}`;
        if (!res.ok) {
          results[key] = { status: res.status, error: text.slice(0, 200) };
          continue;
        }
        // Try to extract stat names
        const data = parsed as { splits?: unknown };
        let stats: Array<{ name?: string; value?: number; displayValue?: string; averageDisplayValue?: string }> | null = null;
        if (data?.splits && !Array.isArray(data.splits)) {
          stats = (data.splits as { categories?: Array<{ stats?: typeof stats }> }).categories?.[0]?.stats ?? null;
        } else if (Array.isArray(data?.splits)) {
          stats = (data.splits as Array<{ stats?: typeof stats }>)[0]?.stats ?? null;
        }
        results[key] = {
          status: res.status,
          hasStats: !!stats,
          statCount: stats?.length ?? 0,
          stats: stats?.map((s) => ({ name: s.name, value: s.value, displayValue: s.displayValue, averageDisplayValue: s.averageDisplayValue })) ?? null,
          rawSnippet: !stats ? text.slice(0, 500) : undefined,
        };
      } catch (e) {
        results[`${yr}/type${type}`] = { error: String(e) };
      }
    }
  }

  return Response.json({ espnId, results });
}
