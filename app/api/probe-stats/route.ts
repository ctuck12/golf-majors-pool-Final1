export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  if (!name) return Response.json({ error: 'name required' });

  const espnId = await getEspnId(name);

  // Fetch ESPN overview raw data
  let espnOverviewRaw: unknown = null;
  if (espnId) {
    try {
      const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store' });
      if (res.ok) espnOverviewRaw = await res.json();
    } catch (e) {
      espnOverviewRaw = { error: String(e) };
    }
  }

  // Fetch PGA Tour GQL raw data
  let pgaGqlRaw: unknown = null;
  if (pgaTourId) {
    try {
      const query = `
        query PlayerProfileStats($playerId: ID!) {
          playerProfileStats(playerId: $playerId) {
            stats { statId displayValue rank }
          }
        }
      `;
      const res = await fetch(PGA_GQL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PGA_API_KEY,
          'Referer': 'https://www.pgatour.com/',
          'Origin': 'https://www.pgatour.com',
        },
        body: JSON.stringify({ query, variables: { playerId: pgaTourId } }),
        signal: AbortSignal.timeout(8000),
      });
      pgaGqlRaw = { status: res.status, data: res.ok ? await res.json() : await res.text() };
    } catch (e) {
      pgaGqlRaw = { error: String(e) };
    }
  }

  // Extract ESPN category names and values for diagnosis
  const overview = espnOverviewRaw as Record<string, unknown> | null;
  const summaryStats = (overview?.summaryStatistics as Array<{ name?: string; displayValue?: string }> | undefined) ?? [];
  const categories = ((overview?.seasonRankings as Record<string, unknown>)?.categories as Array<{ name?: string; displayValue?: string; value?: number }> | undefined) ?? [];

  return Response.json({
    espnId,
    pgaTourId,
    espnSummaryStatNames: summaryStats.map((s) => ({ name: s.name, value: s.displayValue })),
    espnCategoryNames: categories.map((c) => ({ name: c.name, value: c.displayValue ?? c.value })),
    pgaGqlRaw,
  });
}
