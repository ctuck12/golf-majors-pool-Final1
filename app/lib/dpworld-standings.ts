import redis from '@/app/lib/redis';
import { getActiveSeason } from '@/app/lib/tournament-config';

// Live DP World Tour "Race to Dubai" standings, sourced from ESPN's European Tour (league code `eur`)
// standings feed — the same provider that already powers the OWGR and FedEx bubbles. ONE bulk call
// returns the whole ranked field; we cache it in Redis for 12h so ESPN is hit at most a couple times
// a day (no per-player calls, no loops). Consumers fall back to the manual snapshot for anyone the
// live feed doesn't list.

const STANDINGS_URL = (season: number) =>
  `https://site.web.api.espn.com/apis/v2/sports/golf/eur/standings?season=${season}`;

const CACHE_KEY = 'dpworld-standings:v1';
const TTL = 43200; // 12 hours

// Normalize a player name for matching (accents/case/spacing) — mirrors the route's normalizer.
export function normalizeDpwName(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss')
    .replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

type EspnStandings = {
  children?: Array<{
    name?: string; displayName?: string; abbreviation?: string;
    standings?: {
      entries?: Array<{
        athlete?: { displayName?: string; fullName?: string; shortName?: string };
        stats?: Array<{ name?: string; type?: string; abbreviation?: string; value?: number; displayValue?: string }>;
      }>;
    };
  }>;
};

// Parse ESPN's standings payload into a normalized-name -> rank map. Robust to the exact stat naming:
// prefers an explicit "rank" stat, else uses the entry's position (ESPN returns entries in rank order).
export function parseDpWorldStandings(data: EspnStandings): Record<string, number> {
  const children = data.children ?? [];
  // The Race to Dubai list is the standings group with the most entries.
  let entries: NonNullable<NonNullable<EspnStandings['children']>[number]['standings']>['entries'] = [];
  for (const c of children) {
    const e = c.standings?.entries ?? [];
    if (e.length > (entries?.length ?? 0)) entries = e;
  }
  const map: Record<string, number> = {};
  (entries ?? []).forEach((e, i) => {
    const name = e.athlete?.displayName ?? e.athlete?.fullName ?? e.athlete?.shortName;
    if (!name) return;
    const rankStat = (e.stats ?? []).find((s) =>
      /rank/i.test(s.type ?? '') || /rank/i.test(s.name ?? '') || /rank/i.test(s.abbreviation ?? ''),
    );
    const rankFromStat = rankStat && typeof rankStat.value === 'number' && rankStat.value > 0
      ? Math.round(rankStat.value)
      : null;
    const rank = rankFromStat ?? i + 1;
    const key = normalizeDpwName(name);
    // First occurrence wins (entries are rank-ordered, so this is the best rank for the name).
    if (key && !(key in map)) map[key] = rank;
  });
  return map;
}

async function fetchAndBuild(season: number): Promise<Record<string, number>> {
  const res = await fetch(STANDINGS_URL(season), { cache: 'no-store', signal: AbortSignal.timeout(9000) });
  if (!res.ok) return {};
  const data = (await res.json()) as EspnStandings;
  return parseDpWorldStandings(data);
}

// Returns the live Race to Dubai map (normalized name -> rank), cached in Redis for 12h.
// Returns an empty object on any failure so callers can fall back to the manual snapshot.
export async function getDpWorldStandings(): Promise<Record<string, number>> {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached as string);
  } catch { /* fall through to build */ }

  try {
    const season = getActiveSeason();
    let map = await fetchAndBuild(season);
    // Early in a new calendar year the DP World season may still be indexed under the prior year.
    if (Object.keys(map).length === 0) map = await fetchAndBuild(season - 1);
    if (Object.keys(map).length > 0) {
      try { await redis.setex(CACHE_KEY, TTL, JSON.stringify(map)); } catch { /* ignore cache write */ }
    }
    return map;
  } catch {
    return {};
  }
}
