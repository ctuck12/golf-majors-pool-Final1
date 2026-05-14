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

  const sorted = [...competitors].sort((a, b) => (a.order as number) - (b.order as number));

  // Full raw dump of one early player and one late player so we can see every field
  const rawEarly = sorted[0] ?? null;
  const rawLate = sorted[sorted.length - 1] ?? null;

  // Summary of all (order, name, score, thru derived from linescores, all top-level keys)
  const summary = sorted.slice(-20).map((c) => {
    const ls = c.linescores as { period: number; linescores?: unknown[] }[] | undefined;
    const r2 = ls?.find((r) => r.period === 2);
    const thruHoles = r2?.linescores?.length ?? 0;
    return {
      order: c.order,
      name: (c.athlete as { displayName?: string })?.displayName,
      score: c.score,
      thruHoles,
      keys: Object.keys(c),
      status: c.status,
    };
  });

  return Response.json({ total: competitors.length, rawEarly, rawLate, summary });
}
