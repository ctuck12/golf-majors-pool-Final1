import { getEspnId } from './espn-player-season';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

export type PlayerStats = {
  drivingDistance: string | null;
  drivingAccuracy: string | null;
  gir: string | null;
  scrambling: string | null;
  sandSaves: string | null;
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
  sgTeeToGreen: string | null;
  statRanks: Partial<Record<string, string>> | null;
  statAvgs: Partial<Record<string, string>> | null;
  rounds: string[] | null;
};

type Stat = { name?: string; value?: number; displayValue?: string; rank?: number; average?: number; averageDisplayValue?: string };
type SummaryStat = { name?: string; displayValue?: string };

type Overview = {
  summaryStatistics?: SummaryStat[];
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function buildRankAvgMaps(
  stats: Stat[],
  labelMap: Record<string, string>,
): { ranks: Partial<Record<string, string>>; avgs: Partial<Record<string, string>> } {
  const ranks: Partial<Record<string, string>> = {};
  const avgs: Partial<Record<string, string>> = {};
  for (const [statName, label] of Object.entries(labelMap)) {
    const s = stats.find((st) => st.name === statName);
    if (!s) continue;
    if (s.rank != null && s.rank > 0) ranks[label] = ordinal(s.rank);
    const avgDv = s.averageDisplayValue ?? (s.average != null ? String(s.average) : undefined);
    if (avgDv && avgDv !== '-' && avgDv !== '--') avgs[label] = avgDv;
  }
  return { ranks, avgs };
}

// Extract value from the numeric value field (used when displayValue is "0" but value is non-zero)
function statNumVal(stats: Stat[], name: string, suffix = ''): string | null {
  const s = getStat(stats, name);
  if (!s || s.value == null || s.value === 0) return null;
  return suffix ? `${s.value}${suffix}` : String(s.value);
}

// Extract value from averageDisplayValue or average field (used when displayValue is 0)
function statAvgVal(stats: Stat[], name: string, suffix = ''): string | null {
  const s = getStat(stats, name);
  if (!s) return null;
  const dv = s.averageDisplayValue ?? (s.average != null ? String(s.average) : null);
  if (!dv || dv === '-' || dv === '--') return null;
  if (!isNaN(parseFloat(dv)) && parseFloat(dv) === 0) return null;
  return suffix ? `${dv}${suffix}` : dv;
}

function summaryStatVal(stats: SummaryStat[], name: string, suffix = ''): string | null {
  const s = stats.find((st) => st.name === name);
  if (!s) return null;
  const dv = s.displayValue ?? '';
  if (!dv || dv === '-' || dv === '--') return null;
  if (!isNaN(parseFloat(dv)) && parseFloat(dv) === 0) return null;
  return suffix ? `${dv}${suffix}` : dv;
}

function extractSeason(data: Overview): PlayerStats {
  const cats = data.seasonRankings?.categories ?? [];
  const sumStats = data.summaryStatistics ?? [];
  const names = data.statistics?.names ?? [];
  const splits = data.statistics?.splits ?? [];
  const pgaSplit = splits.find((s) => s.displayName?.includes('PGA')) ?? splits[0];
  const avgIdx = names.findIndex((n) => /scoring average/i.test(n));
  const scoringAvg = pgaSplit && avgIdx >= 0 ? (pgaSplit.stats[avgIdx] ?? null) : null;

  // Helper: extract a stat value from statistics.splits by searching names for a pattern
  function splitStatVal(pattern: RegExp, suffix = ''): string | null {
    const idx = names.findIndex((n) => pattern.test(n));
    if (idx < 0 || !pgaSplit) return null;
    const raw = pgaSplit.stats[idx] ?? '';
    if (!raw || raw === '-' || raw === '--') return null;
    const num = parseFloat(raw.replace('%', ''));
    if (isNaN(num) || num === 0) return null;
    if (raw.includes('%')) return raw;
    return suffix ? `${raw}${suffix}` : raw;
  }

  // GIR: 'greensHit' has raw count of greens hit; 'totalDrives' = 9-hole halves played
  // (rounds × 2), so total holes = totalDrives × 9. GIR% = greensHit / (totalDrives × 9).
  const greensHitStat = getStat(cats, 'greensHit');
  const totalDrivesStat = getStat(cats, 'totalDrives');
  const bprStat = getStat(cats, 'birdiesPerRound');
  const girComputed = (() => {
    if (!greensHitStat?.value || greensHitStat.value < 10) return null;
    // Primary: totalDrives × 9 = total holes played (confirmed: 84 × 9 = 756 = 42 rounds × 18)
    if (totalDrivesStat?.value && totalDrivesStat.value > 2) {
      const pct = (greensHitStat.value / (totalDrivesStat.value * 9)) * 100;
      if (pct > 40 && pct < 90) return `${pct.toFixed(2)}%`;
    }
    return null;
  })();

  const gir =
    statAvgVal(cats, 'greensHit', '%') ??
    girComputed ??
    statAvgVal(cats, 'greensInRegPct', '%') ??
    summaryStatVal(sumStats, 'greensInRegPct', '%') ??
    summaryStatVal(sumStats, 'girPct', '%') ??
    statVal(cats, 'gir', '%') ??
    statVal(cats, 'greensInReg', '%') ??
    statVal(cats, 'greensInRegPct', '%') ??
    statVal(cats, 'girPct', '%') ??
    statNumVal(cats, 'gir', '%') ??
    statNumVal(cats, 'greensInReg', '%') ??
    statNumVal(cats, 'greensInRegPct', '%');

  // Scrambling: ESPN uses several names across player profiles
  const scrambling =
    statVal(cats, 'scrambling', '%') ??
    statVal(cats, 'scramblingPct', '%') ??
    summaryStatVal(sumStats, 'scrambling', '%') ??
    summaryStatVal(sumStats, 'scramblingPct', '%') ??
    splitStatVal(/scrambling/i, '%') ??
    statNumVal(cats, 'scrambling', '%') ??
    statNumVal(cats, 'scramblingPct', '%');

  // ESPN stores sandSaves displayValue as a raw fraction (e.g. "0.500") while
  // averageDisplayValue holds the true percentage ("62.5"). Always prefer averageDisplayValue.
  const sandSaves =
    statAvgVal(cats, 'sandSaves', '%') ??
    statAvgVal(cats, 'sandSavePct', '%') ??
    statAvgVal(cats, 'sandSave', '%') ??
    statAvgVal(cats, 'bunkerSavePct', '%') ??
    summaryStatVal(sumStats, 'sandSaves', '%') ??
    summaryStatVal(sumStats, 'sandSavePct', '%') ??
    splitStatVal(/sand save/i, '%') ??
    splitStatVal(/bunker save/i, '%') ??
    statVal(cats, 'sandSaves', '%') ??
    statVal(cats, 'sandSavePct', '%') ??
    statVal(cats, 'sandSave', '%') ??
    statVal(cats, 'bunkerSavePct', '%');

  const SEASON_STAT_LABEL_MAP: Record<string, string> = {
    yardsPerDrive: 'Drive Dist',
    driveAccuracyPct: 'Drive Acc',
    greensHit: 'GIR%',
    greensInRegPct: 'GIR%',
    scramblingPct: 'Scrambling%',
    scrambling: 'Scrambling%',
    sandSaves: 'Sand Saves%',
    puttsPerRound: 'Putts/Round',
    avgPutts: 'Putts/Round',
    puttsGirAvg: 'Putts/Green',
    proximity: 'Proximity',
    proxHole: 'Proximity',
    birdiesPerRound: 'Birdies/Rd',
    sgTotal: 'SG: Total',
    sgOffTee: 'SG: Off Tee',
    sgApproach: 'SG: Approach',
    sgAroundGreen: 'SG: Around',
    sgPutting: 'SG: Putting',
    sgTeeToGreen: 'SG: Tee-to-Green',
    teeToGreen: 'SG: Tee-to-Green',
  };
  const { ranks: statRanks, avgs: statAvgs } = buildRankAvgMaps(cats, SEASON_STAT_LABEL_MAP);

  return {
    drivingDistance: statNumVal(cats, 'yardsPerDrive') ?? statVal(cats, 'yardsPerDrive'),
    drivingAccuracy: statVal(cats, 'driveAccuracyPct', '%') ?? statNumVal(cats, 'driveAccuracyPct', '%'),
    gir,
    scrambling,
    sandSaves,
    puttAverage: statVal(cats, 'puttsGirAvg') ?? statNumVal(cats, 'puttsGirAvg'),
    avgPuttsPerRound: statVal(cats, 'puttsPerRound') ?? statVal(cats, 'avgPutts') ?? statVal(cats, 'avgPutt') ?? statNumVal(cats, 'puttsPerRound') ?? statNumVal(cats, 'avgPutts'),
    proximity: statVal(cats, 'proximity') ?? statVal(cats, 'proxHole') ?? statNumVal(cats, 'proximity') ?? statNumVal(cats, 'proxHole'),
    scoringAverage: scoringAvg ?? summaryStatVal(sumStats, 'scoringAverage') ?? summaryStatVal(sumStats, 'avgScore') ?? statVal(cats, 'scoringAverage') ?? statVal(cats, 'avgScore') ?? statNumVal(cats, 'scoringAverage') ?? statNumVal(cats, 'avgScore'),
    birdiesPerRound: statVal(cats, 'birdiesPerRound') ?? statNumVal(cats, 'birdiesPerRound'),
    birdies: null,
    pars: null,
    bogeys: null,
    eagles: null,
    scoreToPar: null,
    sgTotal: summaryStatVal(sumStats, 'strokesGainedTotal') ?? summaryStatVal(sumStats, 'sgTotal') ?? statVal(cats, 'strokesGainedTotal') ?? statVal(cats, 'sgTotal'),
    sgOffTee: summaryStatVal(sumStats, 'strokesGainedOffTee') ?? summaryStatVal(sumStats, 'sgOffTee') ?? statVal(cats, 'strokesGainedOffTee') ?? statVal(cats, 'sgOffTee'),
    sgApproach: summaryStatVal(sumStats, 'strokesGainedApproach') ?? summaryStatVal(sumStats, 'sgApproach') ?? statVal(cats, 'strokesGainedApproach') ?? statVal(cats, 'sgApproach'),
    sgAroundGreen: summaryStatVal(sumStats, 'strokesGainedAroundGreen') ?? summaryStatVal(sumStats, 'sgAroundGreen') ?? statVal(cats, 'strokesGainedAroundGreen') ?? statVal(cats, 'sgAroundGreen'),
    sgPutting: summaryStatVal(sumStats, 'strokesGainedPutting') ?? summaryStatVal(sumStats, 'sgPutting') ?? statVal(cats, 'strokesGainedPutting') ?? statVal(cats, 'sgPutting'),
    sgTeeToGreen: summaryStatVal(sumStats, 'strokesGainedTeeToGreen') ?? summaryStatVal(sumStats, 'sgTeeToGreen') ?? statVal(cats, 'sgTeeToGreen') ?? statVal(cats, 'teeToGreen'),
    statRanks: Object.keys(statRanks).length > 0 ? statRanks : null,
    statAvgs: Object.keys(statAvgs).length > 0 ? statAvgs : null,
    rounds: null,
  };
}

function extractTournament(stats: Stat[]): PlayerStats {
  const empty: PlayerStats = {
    drivingDistance: null, drivingAccuracy: null, gir: null, scrambling: null, sandSaves: null,
    puttAverage: null, avgPuttsPerRound: null, proximity: null,
    scoringAverage: null, birdiesPerRound: null,
    birdies: null, pars: null, bogeys: null, eagles: null, scoreToPar: null,
    sgTotal: null, sgOffTee: null, sgApproach: null, sgAroundGreen: null, sgPutting: null, sgTeeToGreen: null,
    statRanks: null, statAvgs: null,
    rounds: null,
  };

  // regScore = total strokes. Check several alternate names ESPN uses across endpoints.
  const total = getStat(stats, 'regScore')
    ?? getStat(stats, 'totalStrokes')
    ?? getStat(stats, 'totalScore')
    ?? getStat(stats, 'score');
  const totalVal = total?.value ?? parseFloat(total?.displayValue ?? '0');
  if (!totalVal || totalVal === 0) return empty;

  const parseStat = getStat(stats, 'pars');
  const hasScoring = (parseStat?.value ?? 0) > 0;
  const scoreToParStat = getStat(stats, 'scoreToPar') ?? getStat(stats, 'topar') ?? getStat(stats, 'toPar');

  return {
    drivingDistance: statVal(stats, 'driveDistAvg'),
    drivingAccuracy: statVal(stats, 'driveAccuracyPct', '%'),
    gir: statVal(stats, 'gir', '%'),
    scrambling: statVal(stats, 'scramblingPct', '%') ?? statVal(stats, 'scrambling', '%') ?? statVal(stats, 'scrambPct', '%'),
    sandSaves: statVal(stats, 'sandSaves', '%'),
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
    sgTeeToGreen: statVal(stats, 'sgTeeToGreen') ?? statVal(stats, 'teeToGreen') ?? statVal(stats, 'sgBallStriking'),
    ...(() => {
      const TOURN_STAT_LABEL_MAP: Record<string, string> = {
        driveDistAvg: 'Drive Dist',
        driveAccuracyPct: 'Drive Acc',
        gir: 'GIR%',
        scramblingPct: 'Scrambling%',
        scrambling: 'Scrambling%',
        sandSaves: 'Sand Saves%',
        puttsPerRound: 'Putts/Round',
        avgPutts: 'Putts/Round',
        proximity: 'Proximity',
        proxHole: 'Proximity',
        approachProximity: 'Proximity',
      };
      const { ranks, avgs } = buildRankAvgMaps(stats, TOURN_STAT_LABEL_MAP);
      return {
        statRanks: Object.keys(ranks).length > 0 ? ranks : null,
        statAvgs: Object.keys(avgs).length > 0 ? avgs : null,
      };
    })(),
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
    const regScoreStat = getStat(statsArr, 'regScore') ?? getStat(statsArr, 'totalStrokes') ?? getStat(statsArr, 'totalScore') ?? getStat(statsArr, 'score');
    const regScore = regScoreStat?.value ?? parseFloat(regScoreStat?.displayValue ?? '0');
    const scoreToParStat2 = getStat(statsArr, 'scoreToPar') ?? getStat(statsArr, 'topar') ?? getStat(statsArr, 'toPar');
    const scoreToPar = scoreToParStat2?.value ?? 0;
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

// ESPN Core athlete season stats — same format as competitor stats, often includes sandSaves
async function fetchCoreAthleteSeasonStats(espnId: string): Promise<Stat[] | null> {
  const year = new Date().getFullYear();
  const urls = [
    `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/statistics`,
    `${ESPN_CORE}/pga/seasons/${year - 1}/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/pga/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/pga/athletes/${espnId}/statistics`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      // Handle multiple possible response shapes from ESPN Core
      const data = await res.json() as {
        splits?: { categories?: Array<{ stats?: Stat[] }>; displayName?: string } | Array<{ stats?: Stat[]; displayName?: string }>;
        categories?: Array<{ stats?: Stat[] }>;
        stats?: Stat[];
      };
      // Shape 1: splits.categories[0].stats (competitor stats format)
      if (data?.splits && !Array.isArray(data.splits)) {
        const cats = (data.splits as { categories?: Array<{ stats?: Stat[] }> }).categories;
        const stats = cats?.[0]?.stats;
        if (Array.isArray(stats) && stats.length > 0) return stats;
      }
      // Shape 2: splits[0].stats (array format)
      if (Array.isArray(data?.splits)) {
        for (const split of data.splits as Array<{ stats?: Stat[] }>) {
          if (Array.isArray(split?.stats) && split.stats.length > 0) return split.stats;
        }
      }
      // Shape 3: categories[0].stats
      const cats2 = data?.categories;
      if (Array.isArray(cats2) && cats2[0]?.stats?.length) return cats2[0].stats;
      // Shape 4: top-level stats array
      if (Array.isArray(data?.stats) && data.stats.length > 0) return data.stats;
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchPlayerSeasonStats(name: string): Promise<PlayerStats | null> {
  const espnId = await getEspnId(name);
  if (!espnId) return null;
  const [overviewData, coreStats] = await Promise.all([
    fetchOverview(espnId),
    fetchCoreAthleteSeasonStats(espnId),
  ]);
  if (!overviewData) return null;
  const stats = extractSeason(overviewData);
  // Fill in sandSaves from ESPN Core athlete stats if the overview didn't have it
  if (!stats.sandSaves && coreStats) {
    stats.sandSaves =
      statVal(coreStats, 'sandSaves', '%') ??
      statVal(coreStats, 'sandSavePct', '%') ??
      statVal(coreStats, 'sandSave', '%') ??
      null;
  }
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
          const rsStat = getStat(statsArr, 'regScore') ?? getStat(statsArr, 'totalStrokes') ?? getStat(statsArr, 'totalScore');
          const regScore = rsStat?.value ?? parseFloat(rsStat?.displayValue ?? '0');
          const stpStat = getStat(statsArr, 'scoreToPar') ?? getStat(statsArr, 'topar') ?? getStat(statsArr, 'toPar');
          const scoreToPar = stpStat?.value ?? 0;
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
