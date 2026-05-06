import { getPlayerPhotoRegistry, upsertPlayerPhotoRegistry } from '@/app/lib/player-registry';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

export async function GET() {
  // Always upsert built-in pool entries so ID corrections in player-pool.ts take effect immediately
  await upsertPlayerPhotoRegistry(
    PLAYER_POOL_WITH_PGA_IDS.map((p) => ({ name: p.name, pgaTourId: p.pgaTourId })),
  );
  const registry = await getPlayerPhotoRegistry();
  return Response.json({ registry });
}
