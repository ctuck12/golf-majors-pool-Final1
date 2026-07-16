import redis from './redis';
import { canonicalNameKey } from './name-match';
import { applyNameAlias } from './name-aliases';

// Amateur / PGA-club-professional flags detected from uploaded fields & salary lists.
//
// When the commissioner uploads a full tournament field or salary pick list, player names may carry
// markers: "(a)" for amateurs (universal golf convention) and "(c)"/"(cp)"/"(club pro)" for PGA
// Championship club professionals. detectPlayerTags() (name-match.ts) strips those markers so name
// matching still works, and reports the flags. This store persists the flags (as order-independent
// canonical name keys) so the bio popup can show an "Amateur" badge and the PGA seal automatically.
//
// Flags are additive: once a player is flagged in any upload they stay flagged (a later clean list
// that omits the marker won't un-flag them), which matches how these designations work in practice.

const STORE_KEY = 'player-tags:v1';

export type PlayerTags = {
  amateur: string[]; // canonicalNameKey list
  clubPro: string[]; // canonicalNameKey list
};

// Corrections for mistaken upload markers — these players are professionals and must never
// show the AMATEUR badge. Filtered at read time so a re-upload can't reintroduce the flag.
const NEVER_AMATEUR = new Set([canonicalNameKey('Johnny Keefer'), canonicalNameKey('John Keefer'), canonicalNameKey('Jack Buchanan')]);

export async function getPlayerTags(): Promise<PlayerTags> {
  try {
    const raw = await redis.get(STORE_KEY);
    if (!raw) return { amateur: [], clubPro: [] };
    const parsed = JSON.parse(raw as string) as Partial<PlayerTags>;
    return {
      amateur: (Array.isArray(parsed.amateur) ? parsed.amateur : []).filter((ck) => !NEVER_AMATEUR.has(ck)),
      clubPro: Array.isArray(parsed.clubPro) ? parsed.clubPro : [],
    };
  } catch {
    return { amateur: [], clubPro: [] };
  }
}

// Merge newly-detected amateur / club-pro names (raw names, canonicalized here) into the store.
// Returns the updated, deduped tag lists.
export async function mergePlayerTags(amateurNames: string[], clubProNames: string[]): Promise<PlayerTags> {
  const current = await getPlayerTags();
  const amateur = new Set(current.amateur);
  const clubPro = new Set(current.clubPro);
  let changed = false;
  // Alias full/alternate spellings to the pool name before keying, so a marker on "Benjamin James"
  // flags the pool's "Ben James" (the client checks tags against the pool name).
  for (const n of amateurNames) {
    const ck = canonicalNameKey(applyNameAlias(n));
    if (ck && !amateur.has(ck)) { amateur.add(ck); changed = true; }
  }
  for (const n of clubProNames) {
    const ck = canonicalNameKey(applyNameAlias(n));
    if (ck && !clubPro.has(ck)) { clubPro.add(ck); changed = true; }
  }
  const next: PlayerTags = { amateur: [...amateur], clubPro: [...clubPro] };
  if (changed) await redis.set(STORE_KEY, JSON.stringify(next));
  return next;
}
