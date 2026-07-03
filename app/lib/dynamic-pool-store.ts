import redis from './redis';
import { canonicalNameKey } from './name-match';

// Auto-added pool players.
//
// The draft pool (player-pool.ts) is a static list. When the commissioner uploads a salary pick list
// (see salary-overrides-store.ts), any name NOT already in the static pool used to be dropped — so
// club pros / amateurs / new field players never appeared on the pick sheet. This store fixes that:
// unmatched names are auto-added here (persisted in Redis), given a stable high ID, and merged into
// the pool everywhere the pick sheet is built. Bio/photo still resolve by name via ESPN; PGA-specific
// stats fill in once a pgaTourId is known (0 = not yet resolved, same convention as the static pool).

export type DynamicPlayer = {
  id: number;
  name: string;
  pgaTourId: number;   // 0 until resolved
  worldRank: number;
  defaultOdds: string; // placeholder; real salary/rank come from the commissioner's uploaded list
  espnId?: string;     // resolved by name at add time, for the headshot
};

const STORE_KEY = 'dynamic-pool:v1';
// High base so auto-assigned IDs never collide with static pool IDs (1–~283, next 284) or the
// retired IDs, and stay stable across re-uploads (saved rosters reference IDs by number).
const ID_BASE = 500000;

export async function getDynamicPlayers(): Promise<DynamicPlayer[]> {
  try {
    const raw = await redis.get(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw as string) as DynamicPlayer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveDynamicPlayers(players: DynamicPlayer[]): Promise<void> {
  await redis.set(STORE_KEY, JSON.stringify(players));
}

// Ensure each entry exists in the dynamic pool (matched by order-independent canonical name). Existing
// players keep their ID (updating rank/espnId if newly known); new ones get the next high ID. Returns
// the full list plus a canonicalNameKey -> id map covering every ensured entry.
export async function ensureDynamicPlayers(
  entries: Array<{ name: string; worldRank: number | null; espnId?: string }>,
): Promise<{ all: DynamicPlayer[]; idByCanon: Record<string, number> }> {
  const all = await getDynamicPlayers();
  const byCanon = new Map(all.map((p) => [canonicalNameKey(p.name), p]));
  let nextId = all.reduce((m, p) => Math.max(m, p.id), ID_BASE - 1) + 1;
  const idByCanon: Record<string, number> = {};
  let changed = false;
  for (const e of entries) {
    const ck = canonicalNameKey(e.name);
    const existing = byCanon.get(ck);
    if (existing) {
      idByCanon[ck] = existing.id;
      if (e.worldRank != null && existing.worldRank !== e.worldRank) { existing.worldRank = e.worldRank; changed = true; }
      if (e.espnId && existing.espnId !== e.espnId) { existing.espnId = e.espnId; changed = true; }
      continue;
    }
    const player: DynamicPlayer = {
      id: nextId++,
      name: e.name,
      pgaTourId: 0,
      worldRank: e.worldRank ?? 9999,
      defaultOdds: '+100000',
      espnId: e.espnId,
    };
    all.push(player);
    byCanon.set(ck, player);
    idByCanon[ck] = player.id;
    changed = true;
  }
  if (changed) await saveDynamicPlayers(all);
  return { all, idByCanon };
}
