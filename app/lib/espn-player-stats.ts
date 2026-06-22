import { getEspnId } from './espn-player-season';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

export type PlayerStats = {
  drivingDistance: string | null;
  drivingAccuracy: string | null;
  gir: string | null;
  scrambling: string | null;
  puttAverage: string | null;
  scoringAverage: string | null;
};

type EspnStat = {
  name?: string;
  displayName?: string;
  value?: number;
  displayValue?: string;
};

type EspnCategory = {
  stats?: EspnStat[];
};

const STAT_KEYS: { field: keyof PlayerStats; patterns: string[] }[] = [
  { field: 'drivingDistance',  patterns: ['drivingdistance', 'driving distance'] },
  { field: 'drivingAccuracy',  patterns: ['drivingaccuracy', 'driving accuracy', 'fairwayshit', 'fairways hit', 'fairways in regulation'] },
  { field: 'gir',              patterns: ['greensinregulation', 'greens in regulation', 'gir', 'greens hit in regulation'] },
  { field: 'scrambling',       patterns: ['scrambling', 'scramblingpct', 'scrambling pct'] },
  { field: 'puttAverage',      patterns: ['puttingaverage', 'putting average', 'puttsperround', 'putts per round', 'avgputts'] },
  { field: 'scoringAverage',   patterns: ['scoringaverage', 'scoring average', 'scoringavgdiff', 'adjusted scoring average'] },
];

function extractStats(categories: EspnCategory[]): PlayerStats {
  const result: PlayerStats = {
    drivingDistance: null, drivingAccuracy: null, gir: null,
    scrambling: null, puttAverage: null, scoringAverage: null,
  };
  for (const cat of categories) {
    for (const stat of cat.stats ?? []) {
      const nameLC = (stat.name ?? '').toLowerCase();
      const displayLC = (stat.displayName ?? '').toLowerCase();
      for (const { field, patterns } of STAT_KEYS) {
        if (result[field] !== null) continue;
        if (patterns.some((p) => nameLC.includes(p) || displayLC.includes(p))) {
          result[field] = stat.displayValue ?? (stat.value != null ? String(stat.value) : null);
          break;
        }
      }
    }
  }
  return result;
}

export async function fetchPlayerSeasonStats(name: string): Promise<PlayerStats | null> {
  const espnId = await getEspnId(name);
  if (!espnId) return null;
  try {
    const res = await fetch(
      `${ESPN_CORE}/pga/seasons/2026/athletes/${espnId}/statistics`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const categories: EspnCategory[] = data.splits?.categories ?? [];
    const stats = extractStats(categories);
    const hasAny = Object.values(stats).some((v) => v !== null);
    return hasAny ? stats : null;
  } catch {
    return null;
  }
}

export async function fetchPlayerTournamentStats(name: string, eventId: string): Promise<PlayerStats | null> {
  const espnId = await getEspnId(name);
  if (!espnId) return null;
  try {
    const res = await fetch(
      `${ESPN_CORE}/pga/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const categories: EspnCategory[] = data.splits?.categories ?? data.categories ?? [];
    const stats = extractStats(categories);
    const hasAny = Object.values(stats).some((v) => v !== null);
    return hasAny ? stats : null;
  } catch {
    return null;
  }
}
