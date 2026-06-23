export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';
import { getActiveSeason } from '@/app/lib/tournament-config';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

async function getRankFromLeaders(
  standingsRes: Response,
  espnId: string,
  categoryName: string,
): Promise<number | null> {
  if (!standingsRes.ok) return null;
  const data = await standingsRes.json();
  const cat = (data.categories as Array<{ name: string; leaders: unknown[] }> | undefined)?.find(
    (c) => c.name === categoryName,
  );
  if (!cat) return null;
  const leaders = cat.leaders as Array<{ athlete: Record<string, string> }>;
  const idx = leaders.findIndex((l) => {
    const ref = Object.values(l.athlete)[0] ?? '';
    return ref.match(/athletes\/(\d+)/)?.[1] === espnId;
  });
  return idx === -1 ? null : idx + 1;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ rank: null, dpWorldRank: null });

  try {
    const season = getActiveSeason();
    const [espnId, fedexRes, dpWorldRes] = await Promise.all([
      getEspnId(name),
      fetch(
        `${ESPN_CORE}/pga/seasons/${season}/types/2/leaders?limit=336`,
        { next: { revalidate: 3600 } },
      ),
      fetch(
        `${ESPN_CORE}/eur/seasons/${season}/types/2/leaders?limit=500`,
        { next: { revalidate: 3600 } },
      ),
    ]);

    if (!espnId) return Response.json({ rank: null, dpWorldRank: null });

    // FedEx Cup uses "cupPoints"; Race to Dubai uses "racePoints"
    const [fedexRank, dpWorldRank] = await Promise.all([
      getRankFromLeaders(fedexRes, espnId, 'cupPoints'),
      getRankFromLeaders(dpWorldRes, espnId, 'racePoints'),
    ]);

    return Response.json({ rank: fedexRank, dpWorldRank });
  } catch {
    return Response.json({ rank: null, dpWorldRank: null });
  }
}
