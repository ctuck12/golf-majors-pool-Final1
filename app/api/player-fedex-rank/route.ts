export const dynamic = 'force-dynamic';

async function getEspnId(name: string): Promise<string | null> {
  const res = await fetch(
    `https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(name)}&limit=1&type=player&sport=golf`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const player = data.results?.[0]?.contents?.[0];
  if (!player) return null;
  const uid: string = player.uid ?? '';
  return uid.split('~a:')?.[1] ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ rank: null });

  try {
    const [espnId, standingsRes] = await Promise.all([
      getEspnId(name),
      fetch(
        'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/2026/types/2/leaders?limit=336',
        { next: { revalidate: 3600 } },
      ),
    ]);

    if (!espnId || !standingsRes.ok) return Response.json({ rank: null });

    const data = await standingsRes.json();
    const cupCat = (data.categories as Array<{ name: string; leaders: unknown[] }> | undefined)?.find(
      (c) => c.name === 'cupPoints',
    );
    if (!cupCat) return Response.json({ rank: null });

    const leaders = cupCat.leaders as Array<{ athlete: Record<string, string> }>;
    const rank = leaders.findIndex((l) => {
      const ref = Object.values(l.athlete)[0] ?? '';
      return ref.match(/athletes\/(\d+)/)?.[1] === espnId;
    });

    return Response.json({ rank: rank === -1 ? null : rank + 1 });
  } catch {
    return Response.json({ rank: null });
  }
}
