export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const RTD_CUP_ID = 'R-2700-2026';
const CACHE_KEY = 'rtd-standings:2026:v1';
const CACHE_TTL = 21600; // 6 hours

type RtdPlayer = { position: string; id: string; name: string };

async function fetchRtdStandings(): Promise<RtdPlayer[]> {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return JSON.parse(cached) as RtdPlayer[];

  const query = `
    query {
      tourCup(id: "${RTD_CUP_ID}") {
        rankings {
          ... on CupRankingPlayer { position id name }
        }
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
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json() as {
    data?: { tourCup?: { rankings?: Array<Partial<RtdPlayer>> } };
  };
  const rankings = (data?.data?.tourCup?.rankings ?? [])
    .filter((r): r is RtdPlayer => !!r.id && !!r.position);

  if (rankings.length > 0) {
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(rankings));
  }
  return rankings;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pgaTourId = searchParams.get('pgaTourId') ?? '';
  if (!pgaTourId) return Response.json({ rank: null });

  try {
    const standings = await fetchRtdStandings();
    const entry = standings.find((r) => String(r.id) === String(pgaTourId));
    if (!entry) return Response.json({ rank: null });
    const rank = parseInt(entry.position);
    return Response.json({ rank: isNaN(rank) ? null : rank });
  } catch {
    return Response.json({ rank: null });
  }
}
