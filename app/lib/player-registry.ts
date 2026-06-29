import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 3 });
const REGISTRY_KEY = 'player-photo-registry';

export type PlayerPhotoRegistry = Record<string, number>; // normalized name → pgaTourId

function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae');
}

export function pgaPhotoUrl(pgaTourId: number): string {
  return `https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_350,q_auto,w_280/headshots_${pgaTourId}.png`;
}

export async function getPlayerPhotoRegistry(): Promise<PlayerPhotoRegistry> {
  const raw = await redis.get(REGISTRY_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PlayerPhotoRegistry;
  } catch {
    return {};
  }
}

export async function upsertPlayerPhotoRegistry(
  entries: Array<{ name: string; pgaTourId: number }>,
): Promise<void> {
  const existing = await getPlayerPhotoRegistry();
  for (const { name, pgaTourId } of entries) {
    existing[normalizeName(name)] = pgaTourId;
  }
  await redis.set(REGISTRY_KEY, JSON.stringify(existing));
}
