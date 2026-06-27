export const dynamic = 'force-dynamic';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';

export async function GET() {
  // Search for McNealy ESPN ID
  const searchRes = await fetch(
    'https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=Maverick%20McNealy&limit=10&type=player',
    { cache: 'no-store' }
  );
  const searchData = await searchRes.json();
  const contents = searchData.results?.[0]?.contents ?? [];
  const player = contents.find((c: { uid?: string }) => c.uid?.includes('s:110') && c.uid?.includes('~a:'));
  const espnId = player?.uid?.split('~a:')?.[1] ?? null;

  if (!espnId) return Response.json({ error: 'ESPN ID not found', searchData });

  const overviewRes = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store' });
  const overview = await overviewRes.json();

  const cats = overview?.seasonRankings?.categories ?? [];
  const sandSavesStat = cats.find((s: { name?: string }) => s.name === 'sandSaves');
  const statisticsNames = overview?.statistics?.names ?? [];
  const statisticsSplits = overview?.statistics?.splits ?? [];
  const sandSavesIdx = statisticsNames.findIndex((n: string) => /sand save/i.test(n));
  const pgaSplit = statisticsSplits.find((s: { displayName?: string }) => s.displayName?.includes('PGA')) ?? statisticsSplits[0];

  return Response.json({
    espnId,
    sandSavesStat,
    allCatNames: cats.map((c: { name?: string }) => c.name),
    statisticsNames,
    sandSavesIdx,
    sandSavesFromSplits: sandSavesIdx >= 0 ? pgaSplit?.stats?.[sandSavesIdx] : null,
    pgaSplitName: pgaSplit?.displayName,
    summaryStats: overview?.summaryStatistics?.filter((s: { name?: string }) => s.name?.toLowerCase().includes('sand')) ?? [],
  });
}
