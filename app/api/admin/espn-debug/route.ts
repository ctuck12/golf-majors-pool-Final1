export const dynamic = 'force-dynamic';

// Temporary debug endpoint — inspect raw ESPN competitor status fields
export async function GET() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${today}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return Response.json({ error: `ESPN ${res.status}` }, { status: 502 });

  const data = await res.json() as { events?: { id: string; competitions?: { competitors?: unknown[] }[] }[] };
  const event = data.events?.find((e) => e.id === '401811947');
  if (!event) return Response.json({ error: 'Event not found', eventIds: data.events?.map((e) => e.id) });

  const competitors = (event.competitions?.[0]?.competitors ?? []) as Record<string, unknown>[];

  // Return first 5 and last 5 by order (leaders + unstarted players)
  const sorted = [...competitors].sort((a, b) => (a.order as number) - (b.order as number));
  const sample = [
    ...sorted.slice(0, 5),
    ...sorted.slice(-10),
  ].map((c) => ({
    id: c.id,
    order: c.order,
    name: (c.athlete as { displayName?: string })?.displayName,
    score: c.score,
    status: c.status,
    linescore_count: (c.linescores as unknown[] | undefined)?.length ?? 0,
  }));

  return Response.json({ total: competitors.length, sample });
}
