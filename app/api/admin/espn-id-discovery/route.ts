export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { getEspnId } from '@/app/lib/espn-player-season';

const SITE = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const SEARCH = 'https://site.api.espn.com/apis/search/v2';
const BATCH = 6;

const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();

type Hit = { uid?: string; displayName?: string; subtitle?: string };

async function rawSearch(query: string): Promise<Hit[]> {
  try {
    const res = await fetch(`${SEARCH}?lang=en&region=us&query=${encodeURIComponent(query)}&limit=20&type=player`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const groups: Array<{ contents?: Hit[] }> = Array.isArray(data.results) ? data.results : [];
    return groups.flatMap((g) => g.contents ?? []);
  } catch { return []; }
}

function golfCandidates(hits: Hit[]): Array<{ id: string; displayName: string; subtitle: string }> {
  const out: Array<{ id: string; displayName: string; subtitle: string }> = [];
  for (const h of hits) {
    if (!h.uid?.includes('s:110') || !h.uid?.includes('~a:')) continue;
    const id = h.uid.split('~a:')[1];
    if (id) out.push({ id, displayName: h.displayName ?? '', subtitle: h.subtitle ?? '' });
  }
  return out;
}

// Confirm an ESPN id actually returns a golf athlete with some bio data.
async function verifyId(id: string): Promise<{ displayName: string; hasBio: boolean } | null> {
  try {
    const res = await fetch(`${SITE}/${id}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const a = (data?.athlete ?? data) as Record<string, unknown>;
    if (!a) return null;
    const hasBio = !!(a.displayDOB ?? a.dateOfBirth ?? a.birthPlace ?? a.displayHeight ?? a.college);
    return { displayName: String(a.displayName ?? a.fullName ?? ''), hasBio };
  } catch { return null; }
}

export async function GET() {
  // Target the players the current resolver still can't place.
  const pool = PLAYER_POOL_WITH_PGA_IDS;
  const unresolved: typeof pool[number][] = [];
  for (let i = 0; i < pool.length; i += BATCH) {
    const batch = pool.slice(i, i + BATCH);
    const ids = await Promise.all(batch.map((p) => getEspnId(p.name).catch(() => null)));
    batch.forEach((p, j) => { if (!ids[j]) unresolved.push(p); });
  }

  const results: Array<Record<string, unknown>> = [];

  for (let i = 0; i < unresolved.length; i += BATCH) {
    const batch = unresolved.slice(i, i + BATCH);
    await Promise.all(batch.map(async (p) => {
      const parts = p.name.split(/\s+/);
      const firstLast = parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : p.name;
      const lastName = parts[parts.length - 1];
      const queries = Array.from(new Set([p.name, firstLast, normName(p.name), lastName]));

      const candMap = new Map<string, { id: string; displayName: string; subtitle: string }>();
      for (const q of queries) {
        for (const c of golfCandidates(await rawSearch(q))) {
          if (!candMap.has(c.id)) candMap.set(c.id, c);
        }
      }
      const candidates = [...candMap.values()];

      const want = normName(p.name);
      const wantFL = normName(firstLast);
      // Auto-pick: exact normalized name match (full or first+last).
      const auto = candidates.find((c) => normName(c.displayName) === want || normName(c.displayName) === wantFL);

      let verified: { displayName: string; hasBio: boolean } | null = null;
      if (auto) verified = await verifyId(auto.id);

      results.push({
        name: p.name,
        pgaTourId: p.pgaTourId,
        autoMatch: auto ? { id: auto.id, displayName: auto.displayName, verified } : null,
        candidates: candidates.slice(0, 8),
      });
    }));
  }

  const autoMatched = results.filter((r) => r.autoMatch);
  const noCandidates = results.filter((r) => (r.candidates as unknown[]).length === 0);

  return Response.json({
    stillUnresolved: unresolved.length,
    autoMatchedCount: autoMatched.length,
    noCandidatesCount: noCandidates.length,
    // Ready-to-paste override lines for the confident auto-matches.
    overrideSnippets: autoMatched.map((r) => `  '${r.name}': '${(r.autoMatch as { id: string }).id}',`),
    results,
  });
}
