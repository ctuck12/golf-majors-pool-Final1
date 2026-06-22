import { getEspnId } from './espn-player-season';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';

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
        competitors?: Array<{ stats?: Stat[] }>;
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
  };
}

function extractTournament(stats: Stat[]): PlayerStats {
  const empty: PlayerStats = {
    drivingDistance: null, drivingAccuracy: null, gir: null, scrambling: null,
    puttAverage: null, avgPuttsPerRound: null, proximity: null,
    scoringAverage: null, birdiesPerRound: null,
    birdies: null, pars: null, bogeys: null, eagles: null, scoreToPar: null,
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
  };
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
  const data = await fetchOverview(espnId);
  if (!data) return null;

  for (const group of data.recentTournaments ?? []) {
    for (const event of group.eventsStats ?? []) {
      if (event.id === eventId) {
        const statsArr = event.competitions?.[0]?.competitors?.[0]?.stats ?? [];
        const stats = extractTournament(statsArr);
        return Object.values(stats).some((v) => v !== null) ? stats : null;
      }
    }
  }

  return null;
}
