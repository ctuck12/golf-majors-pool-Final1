import { getPlayerPhotoRegistry, upsertPlayerPhotoRegistry } from '@/app/lib/player-registry';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

export async function GET() {
  let registry = await getPlayerPhotoRegistry();

  // Seed from built-in pool if the registry is empty
  if (Object.keys(registry).length === 0) {
    await upsertPlayerPhotoRegistry(
      PLAYER_POOL_WITH_PGA_IDS.map((p) => ({ name: p.name, pgaTourId: p.pgaTourId })),
    );
    registry = await getPlayerPhotoRegistry();
  }

  return Response.json({ registry });
}
