export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ rank: null });

  try {
    const [espnId, standingsRes] = await Promise.all([
      getEspnId(name),
      fetch(
        'https://sports.core.api.espn.com/v2/sports/golf/leagues/eur/seasons/2026/types/2/leaders?limit=400',
        { cache: 'force-cache' } as RequestInit,
      ),
    ]);

    if (!espnId || !standingsRes.ok) return Response.json({ rank: null });

    const data = await standingsRes.json();
    const categories = data.categories as Array<{ name: string; leaders: unknown[] }> | undefined;
    if (!Array.isArray(categories) || categories.length === 0) return Response.json({ rank: null });

    // Try each category — Race to Dubai may be named differently
    for (const cat of categories) {
      const leaders = cat.leaders as Array<{ athlete: Record<string, string> }>;
      if (!Array.isArray(leaders) || leaders.length === 0) continue;
      const rank = leaders.findIndex((l) => {
        const ref = Object.values(l.athlete)[0] ?? '';
        return ref.match(/athletes\/(\d+)/)?.[1] === espnId;
      });
      if (rank !== -1) return Response.json({ rank: rank + 1 });
    }

    return Response.json({ rank: null });
  } catch {
    return Response.json({ rank: null });
  }
}
