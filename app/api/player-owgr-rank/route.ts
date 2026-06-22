export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026';

async function getMostRecentRankingsDate(): Promise<string | null> {
  try {
    const res = await fetch(`${ESPN_CORE}/rankings/1`, {
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) return null;
    const data = await res.json();
    const rankings = data.rankings as Array<{ $ref?: string }> | undefined;
    if (!Array.isArray(rankings) || rankings.length === 0) return null;
    // First item is the most recent date
    const ref = rankings[0]?.$ref ?? '';
    const match = ref.match(/\/dates\/(\d{8})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ rank: null });

  try {
    const [espnId, dateKey] = await Promise.all([
      getEspnId(name),
      getMostRecentRankingsDate(),
    ]);

    if (!espnId || !dateKey) return Response.json({ rank: null });

    const rankRes = await fetch(`${ESPN_CORE}/rankings/1/dates/${dateKey}?limit=500`, {
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!rankRes.ok) return Response.json({ rank: null });

    const data = await rankRes.json();

    // ESPN world rankings date entries: try both 'athletes' and 'rankings' array formats
    const entries: Array<Record<string, unknown>> =
      (data.athletes as Array<Record<string, unknown>> | undefined) ??
      (data.rankings as Array<Record<string, unknown>> | undefined) ??
      [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      // Try direct 'athlete' $ref field
      const athleteVal = entry.athlete as Record<string, string> | string | undefined;
      const ref: string =
        typeof athleteVal === 'string'
          ? athleteVal
          : typeof athleteVal === 'object' && athleteVal
          ? (Object.values(athleteVal)[0] ?? '')
          : '';
      const id = ref.match(/athletes\/(\d+)/)?.[1];
      if (id === espnId) {
        // Rank may be explicit in entry, or implied by position
        const explicitRank = entry.rank ?? entry.ranking;
        return Response.json({ rank: typeof explicitRank === 'number' ? explicitRank : i + 1 });
      }
    }

    return Response.json({ rank: null });
  } catch {
    return Response.json({ rank: null });
  }
}
