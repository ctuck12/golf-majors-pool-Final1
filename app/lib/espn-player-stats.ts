import { getEspnId } from './espn-player-season';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

export type PlayerStats = {
  drivingDistance: string | null;
  drivingAccuracy: string | null;
  gir: string | null;
  scrambling: string | null;
  puttAverage: string | null;
  avgPuttsPerRound: string | null;
  proximity: string | null;
  scoringAverage: string | null;
  birdiesPerRound: string | null;
  birdies: string | null;
  pars: string | null;
  bogeys: string | null;
  eagles: string | null;
  scoreToPar: string | null;
  sgTotal: string | null;
  sgOffTee: string | null;
  sgApproach: string | null;
  sgAroundGreen: string | null;
  sgPutting: string | null;
  rounds: string[] | null;
};

type Stat = { name?: string; value?: number; displayValue?: string };

type Overview = {
  seasonRankings?: { categories?: Stat[] };
  statistics?: {
    names?: string[];
    splits?: Array<{ displayName: string; stats: string[] }>;
  };
  recentTournaments?: Array<{
    eventsStats?: Array<{
      id: string;
      competitions?: Array<{
        competitors?: Array<{
          score?: { value?: number; displayValue?: string };
          linescores?: { items?: Array<{ value: number }> };
          stats?: Stat[];
        }>;
      }>;
    }>;
  }>;
};

function getStat(stats: Stat[], name: string): Stat | undefined {
  return stats.find((s) => s.name === name);
}

function statVal(stats: Stat[], name: string, suffix = ''): string | null {
  const s = getStat(stats, name);
  if (!s) return null;
  const dv = s.displayValue ?? '';
  if (!dv || dv === '-' || dv === '--') return null;
  if (!isNaN(parseFloat(dv)) && parseFloat(dv) === 0) return null;
  return suffix ? `${dv}${suffix}` : dv;
}

function extractSeason(data: Overview): PlayerStats {
  const cats = data.seasonRankings?.categories ?? [];
  const names = data.statistics?.names ?? [];
  const splits = data.statistics?.splits ?? [];
  const pgaSplit = splits.find((s) => s.displayName?.includes('PGA')) ?? splits[0];
  const avgIdx = names.findIndex((n) => /scoring average/i.test(n));
  const scoringAvg = pgaSplit && avgIdx >= 0 ? (pgaSplit.stats[avgIdx] ?? null) : null;

  return {
    drivingDistance: statVal(cats, 'yardsPerDrive'),
    drivingAccuracy: statVal(cats, 'driveAccuracyPct', '%'),
    gir: statVal(cats, 'gir', '%'),
    scrambling: statVal(cats, 'sandSaves', '%'),
    puttAverage: statVal(cats, 'puttsGirAvg'),
    avgPuttsPerRound: statVal(cats, 'puttsPerRound') ?? statVal(cats, 'avgPutts') ?? statVal(cats, 'avgPutt'),
    proximity: statVal(cats, 'proximity') ?? statVal(cats, 'proxHole'),
    scoringAverage: scoringAvg,
    birdiesPerRound: statVal(cats, 'birdiesPerRound'),
    birdies: null,
    pars: null,
    bogeys: null,
    eagles: null,
    scoreToPar: null,
    sgTotal: null,
    sgOffTee: null,
    sgApproach: null,
    sgAroundGreen: null,
    sgPutting: null,
    rounds: null,
  };
}

function extractTournament(stats: Stat[]): PlayerStats {
  const empty: PlayerStats = {
    drivingDistance: null, drivingAccuracy: null, gir: null, scrambling: null,
    puttAverage: null, avgPuttsPerRound: null, proximity: null,
    scoringAverage: null, birdiesPerRound: null,
    birdies: null, pars: null, bogeys: null, eagles: null, scoreToPar: null,
    sgTotal: null, sgOffTee: null, sgApproach: null, sgAroundGreen: null, sgPutting: null,
    rounds: null,
  };

  const total = getStat(stats, 'regScore');
  if (!total?.value || total.value === 0) return empty;

  const parseStat = getStat(stats, 'pars');
  const hasScoring = (parseStat?.value ?? 0) > 0;
  const scoreToParStat = getStat(stats, 'scoreToPar');

  return {
    drivingDistance: statVal(stats, 'driveDistAvg'),
    drivingAccuracy: statVal(stats, 'driveAccuracyPct', '%'),
    gir: statVal(stats, 'gir', '%'),
    scrambling: statVal(stats, 'sandSaves', '%'),
    puttAverage: statVal(stats, 'puttsGirAvg'),
    avgPuttsPerRound: statVal(stats, 'puttsPerRound') ?? statVal(stats, 'avgPutts') ?? statVal(stats, 'avgPutt'),
    proximity: statVal(stats, 'proximity') ?? statVal(stats, 'proxHole') ?? statVal(stats, 'approachProximity'),
    scoringAverage: null,
    birdiesPerRound: null,
    scoreToPar: scoreToParStat?.displayValue ?? null,
    birdies: hasScoring ? String(getStat(stats, 'birdies')?.value ?? 0) : null,
    pars: hasScoring ? String(parseStat?.value ?? 0) : null,
    bogeys: hasScoring ? String(getStat(stats, 'bogeys')?.value ?? 0) : null,
    eagles: hasScoring ? String(getStat(stats, 'eagles')?.value ?? 0) : null,
    sgTotal: null,
    sgOffTee: null,
    sgApproach: null,
    sgAroundGreen: null,
    sgPutting: null,
    rounds: null,
  };
}

// Fetch stats directly from ESPN Core — works for any tournament, no recency window
async function fetchCoreCompetitorStats(espnId: string, eventId: string): Promise<Stat[] | null> {
  try {
    const url = `${ESPN_CORE}/pga/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics/0`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json() as { splits?: { categories?: Array<{ stats?: Stat[] }> } };
    const stats = data?.splits?.categories?.[0]?.stats;
    return Array.isArray(stats) && stats.length > 0 ? stats : null;
  } catch {
    return null;
  }
}

// Fetch round-by-round linescores from ESPN Core
async function fetchCoreLinescores(espnId: string, eventId: string, statsArr: Stat[]): Promise<string[] | null> {
  try {
    const url = `${ESPN_CORE}/pga/events/${eventId}/competitions/${eventId}/competitors/${espnId}/linescores`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json() as { items?: Array<{ value?: number }> };
    const items = data?.items;
    if (!Array.isArray(items) || items.length === 0) return null;
    const regScore = getStat(statsArr, 'regScore')?.value ?? 0;
    const scoreToPar = getStat(statsArr, 'scoreToPar')?.value ?? 0;
    if (regScore <= 0) return null;
    const coursePar = Math.round((regScore - scoreToPar) / items.length);
    return items.map((ls) => {
      const toPar = (ls.value ?? 0) - coursePar;
      return toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : String(toPar);
    });
  } catch {
    return null;
  }
}

async function fetchOverview(espnId: string): Promise<Overview | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Overview;
  } catch {
    return null;
  }
}

export async function fetchPlayerSeasonStats(name: string): Promise<PlayerStats | null> {
  const espnId = await getEspnId(name);
  if (!espnId) return null;
  const data = await fetchOverview(espnId);
  if (!data) return null;
  const stats = extractSeason(data);
  return Object.values(stats).some((v) => v !== null) ? stats : null;
}

export async function fetchPlayerTournamentStats(name: string, eventId: string): Promise<PlayerStats | null> {
  const espnId = await getEspnId(name);
  if (!espnId) return null;

  // Primary: ESPN Core direct endpoint — no recency window, works for any historical tournament
  const coreStats = await fetchCoreCompetitorStats(espnId, eventId);
  if (coreStats && coreStats.length > 0) {
    const stats = extractTournament(coreStats);
    const rounds = await fetchCoreLinescores(espnId, eventId, coreStats);
    const hasStats = Object.values(stats).some((v) => v !== null);
    if (hasStats || rounds) return { ...stats, rounds };
  }

  // Fallback: recentTournaments in overview (last ~5-7 events only)
  const data = await fetchOverview(espnId);
  if (!data) return null;

  for (const group of data.recentTournaments ?? []) {
    for (const event of group.eventsStats ?? []) {
      if (event.id === eventId) {
        const competitor = event.competitions?.[0]?.competitors?.[0];
        const statsArr = competitor?.stats ?? [];
        const stats = extractTournament(statsArr);

        let rounds: string[] | null = null;
        const linescore = competitor?.linescores?.items ?? [];
        if (linescore.length > 0) {
          const regScore = getStat(statsArr, 'regScore')?.value ?? 0;
          const scoreToPar = getStat(statsArr, 'scoreToPar')?.value ?? 0;
          if (regScore > 0) {
            const coursePar = Math.round((regScore - scoreToPar) / linescore.length);
            rounds = linescore.map((ls) => {
              const toPar = ls.value - coursePar;
              return toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : String(toPar);
            });
          }
        }

        const hasStats = Object.values(stats).some((v) => v !== null);
        if (!hasStats && !rounds) return null;
        return { ...stats, rounds };
      }
    }
  }

  return null;
}
