export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? 'Scottie Scheffler';
  const eventId = searchParams.get('eventId') ?? '';

  const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
  const ESPN_ATHLETES = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';

  const results: Record<string, unknown> = {};

  let espnId: string | null = null;
  try {
    const search = await fetch(`${ESPN_ATHLETES}?limit=50&active=true`, { signal: AbortSignal.timeout(5000) });
    const sd = await search.json() as { athletes?: Array<{ id?: string; displayName?: string; fullName?: string }> };
    const athletes = sd?.athletes ?? [];
    const found = athletes.find(a =>
      (a.displayName ?? a.fullName ?? '').toLowerCase().includes(name.toLowerCase().split(' ')[1] ?? name.toLowerCase())
    );
    espnId = found?.id ?? null;
    results['espnId'] = espnId;
    results['espnName'] = found?.displayName ?? found?.fullName ?? null;
  } catch (e) { results['espnId_error'] = String(e); }

  if (!espnId) return Response.json(results);

  if (eventId) {
    try {
      const year = new Date().getFullYear();
      const url = `${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics/0`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const j = await r.json() as { splits?: { categories?: Array<{ displayName?: string; stats?: Array<{ name?: string; displayValue?: string }> }> } };
      results['stats_categories'] = j?.splits?.categories?.map(c => ({
        name: c.displayName,
        stats: c.stats?.slice(0, 10)?.map(s => ({ name: s.name, value: s.displayValue })),
      }));
    } catch (e) { results['stats_error'] = String(e); }
  }

  try {
    const r = await fetch(`${ESPN_ATHLETES}/${espnId}/overview`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json() as Record<string, unknown>;
    const stats = (j?.statistics ?? (j?.athlete as Record<string, unknown> | undefined)?.statistics) as Record<string, unknown> | undefined;
    results['overview_names'] = (stats?.names as string[] | undefined)?.slice(0, 20);
    results['overview_splits'] = (stats?.splits as Array<{ displayName?: string; stats?: unknown[] }> | undefined)
      ?.map(s => ({ name: s.displayName, stats: s.stats?.slice(0, 5) }));
  } catch (e) { results['overview_error'] = String(e); }

  return Response.json(results);
}
