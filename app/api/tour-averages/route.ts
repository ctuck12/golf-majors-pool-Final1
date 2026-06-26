export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchTourAverages } from '@/app/lib/pga-tour-averages';

const CACHE_KEY = `tour-averages:v12:${new Date().getFullYear()}`;
const TTL = 21600; // 6 hours

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return Response.json({ averages: JSON.parse(cached) });

    const averages = await fetchTourAverages();
    await redis.setex(CACHE_KEY, TTL, JSON.stringify(averages));
    return Response.json({ averages });
  } catch {
    return Response.json({ averages: {} });
  }
}
