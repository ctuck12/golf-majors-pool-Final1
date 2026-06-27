export const dynamic = 'force-dynamic';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

export async function GET() {
  const espnId = '9530'; // McNealy
  const year = 2026;

  // Fetch all 52 stats from ESPN Core types/2
  let allStats: unknown = null;
  try {
    const url = `${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics/0`;
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    // Find splits — could be splits.categories[0].stats or splits[0].stats
    let stats: Array<{ name?: string; displayValue?: string; value?: number; average?: number; averageDisplayValue?: string; rank?: number }> = [];
    if (j?.splits && !Array.isArray(j.splits)) {
      stats = j.splits.categories?.[0]?.stats ?? [];
    } else if (Array.isArray(j?.splits)) {
      stats = j.splits[0]?.stats ?? [];
    }
    allStats = {
      status: r.status,
      splitsType: typeof j?.splits,
      splitsIsArray: Array.isArray(j?.splits),
      splitsCategoriesLen: j?.splits?.categories?.length,
      statsCount: stats.length,
      allStats: stats.map((s) => ({
        name: s.name,
        displayValue: s.displayValue,
        value: s.value,
        average: s.average,
        averageDisplayValue: s.averageDisplayValue,
        rank: s.rank,
      })),
    };
  } catch (e) {
    allStats = { error: String(e) };
  }

  return Response.json({ espnId, allStats });
}
