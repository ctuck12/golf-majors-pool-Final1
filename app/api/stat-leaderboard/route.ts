export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const TOUR_AVG_LB_PREFIX = 'tour-avg:lb:v1:';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const BATCH_SIZE = 25;
const CURRENT_YEAR = new Date().getFullYear();

// Recent PGA Tour major events — used as reliable source of active PGA Tour player IDs
// (avoids Champions Tour / dual-status players that appear in season athlete lists)
const PGA_EVENT_IDS = ['401811952', '401811947', '401811941']; // US Open, PGA Champ, Masters

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

const LOWER_IS_BETTER = new Set(['scoringAverage', 'puttAverage']);

const statDefs: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number; altMultiplier?: number }> = [
  { key: 'drivingDistance', espnName: 'driveDistAvg', isPercent: false, decimals: 1 },
  { key: 'drivingDistance', espnName: 'yardsPerDrive', isPercent: false, decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensInRegPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'greensInReg', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'girPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scramblingPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambling', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambPct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'savePct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSavePct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSave', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'bunkerSavePct', isPercent: true, decimals: 1 },
  { key: 'puttAverage', espnName: 'puttsGirAvg', isPercent: false, decimals: 3 },
  { key: 'sgTotal', espnName: 'strokesGainedTotal', isPercent: false, decimals: 3 },
  { key: 'sgTotal', espnName: 'sgTotal', isPercent: false, decimals: 3 },
  { key: 'sgOffTee', espnName: 'strokesGainedOffTee', isPercent: false, decimals: 3 },
  { key: 'sgOffTee', espnName: 'sgOffTee', isPercent: false, decimals: 3 },
  { key: 'sgApproach', espnName: 'strokesGainedApproach', isPercent: false, decimals: 3 },
  { key: 'sgApproach', espnName: 'sgApproach', isPercent: false, decimals: 3 },
  { key: 'sgAroundGreen', espnName: 'strokesGainedAroundGreen', isPercent: false, decimals: 3 },
  { key: 'sgAroundGreen', espnName: 'sgAroundGreen', isPercent: false, decimals: 3 },
  { key: 'sgPutting', espnName: 'strokesGainedPutting', isPercent: false, decimals: 3 },
  { key: 'sgPutting', espnName: 'sgPutting', isPercent: false, decimals: 3 },
  { key: 'sgTeeToGreen', espnName: 'strokesGainedTeeToGreen', isPercent: false, decimals: 3 },
  { key: 'sgTeeToGreen', espnName: 'sgTeeToGreen', isPercent: false, decimals: 3 },
  { key: 'scoringAverage', espnName: 'scoringAverage', isPercent: false, decimals: 2 },
  { key: 'scoringAverage', espnName: 'adjScoringAvg', isPercent: false, decimals: 2 },
  { key: 'scoringAverage', espnName: 'scoringAvg', isPercent: false, decimals: 2 },
];

export type StatLeaderboardEntry = {
  rank: number;
  name: string;
  value: string;
};

// Check value, displayValue, average, and averageDisplayValue — different ESPN stats use different fields
function statNumeric(stats: Stat[], name: string): number | null {
  const s = stats.find((x) => x.name === name);
  if (!s) return null;
  // Primary: value field
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  // Secondary: parse displayValue (e.g. "78.2" or "78.2%")
  const dv = parseFloat(s.displayValue ?? '');
  if (!isNaN(dv) && dv !== 0) return dv;
  // averageDisplayValue before average — average may be a raw decimal (0.625) while averageDisplayValue has the display string (62.5)
  const av = parseFloat(s.averageDisplayValue ?? '');
  if (!isNaN(av) && av !== 0) return av;
  if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
  return null;
}

function formatValue(v: number, key: string): string {
  const def = statDefs.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

// Get unique PGA Tour player ESPN IDs from recent major events
// This guarantees we only show active PGA Tour players (not Champions Tour)
async function fetchPgaPlayerIds(): Promise<string[]> {
  const idSet = new Set<string>();
  await Promise.all(PGA_EVENT_IDS.map(async (eventId) => {
    try {
      const res = await fetch(
        `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`,
        { cache: 'no-store', signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return;
      const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
      for (const item of data.items ?? []) {
        const id = item.id ?? item.$ref?.match(/competitors\/(\d+)/)?.[1];
        if (id) idSet.add(id);
      }
    } catch { /* ignore */ }
  }));
  console.log(`[stat-lb] pgaPlayerIds=${idSet.size}`);
  return Array.from(idSet);
}

type OverviewData = { seasonRankings?: { categories?: Stat[] }; summaryStatistics?: Stat[] };

// Fetch overview and return the raw data — callers merge categories+summaryStatistics as needed
async function fetchAthleteOverviewStats(espnId: string): Promise<OverviewData | null> {
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as OverviewData;
    const hasData = (data?.seasonRankings?.categories?.length ?? 0) > 0 || (data?.summaryStatistics?.length ?? 0) > 0;
    return hasData ? data : null;
  } catch {
    return null;
  }
}

// Fetch savePct (sand saves %) from ESPN Core types/2 — only reliable source for this stat
async function fetchCoreSandSavesPct(espnId: string): Promise<number | null> {
  try {
    const url = `${ESPN_CORE}/seasons/${CURRENT_YEAR}/types/2/athletes/${espnId}/statistics/0`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      splits?: { categories?: Array<{ stats?: Stat[] }> } | Array<{ stats?: Stat[] }>;
    };
    let stats: Stat[] = [];
    if (data?.splits && !Array.isArray(data.splits)) {
      stats = (data.splits as { categories?: Array<{ stats?: Stat[] }> }).categories?.[0]?.stats ?? [];
    } else if (Array.isArray(data?.splits)) {
      stats = (data.splits as Array<{ stats?: Stat[] }>)[0]?.stats ?? [];
    }
    const s = stats.find((x) => x.name === 'savePct');
    if (s?.value && !isNaN(s.value) && s.value > 0) return s.value;
    const dv = parseFloat(s?.displayValue ?? '');
    if (!isNaN(dv) && dv > 0) return dv;
    return null;
  } catch {
    return null;
  }
}

// Compute GIR% from raw ESPN counts: greensHit / (totalDrives × 9) × 100
// totalDrives = 9-hole halves played, so totalDrives × 9 = total holes played
function computeGirPct(cats: Stat[]): number | null {
  const gh = cats.find((s) => s.name === 'greensHit');
  const td = cats.find((s) => s.name === 'totalDrives');
  if (!gh?.value || !td?.value || td.value <= 2) return null;
  const pct = (gh.value / (td.value * 9)) * 100;
  return pct > 40 && pct < 90 ? pct : null;
}

async function fetchAthleteName(espnId: string): Promise<string> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/athletes/${espnId}?lang=en&region=us`,
      { cache: 'no-store', signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return '';
    const data = await res.json() as { displayName?: string; fullName?: string; firstName?: string; lastName?: string };
    return data?.displayName ?? data?.fullName
      ?? ([data?.firstName, data?.lastName].filter(Boolean).join(' '))
      ?? '';
  } catch {
    return '';
  }
}

async function batchAll<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...await Promise.all(tasks.slice(i, i + size).map((t) => t())));
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  if (!statKey) return Response.json({ entries: [] });

  const cacheKey = `stat-lb:v15:${statKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const ids = await fetchPgaPlayerIds();
    if (ids.length === 0) return Response.json({ entries: [] });

    const defsForKey = statDefs.filter((d) => d.key === statKey);
    const playerValues: Array<{ espnId: string; value: number }> = [];

    // Fetch overview stats for all players (contains season stats, GIR %, sand saves %, scrambling, etc.)
    const allOverviewData = await batchAll(
      ids.map((id) => () => fetchAthleteOverviewStats(id)),
      BATCH_SIZE,
    );

    // sandSaves: savePct only exists in ESPN Core types/2, not overview — fetch per player
    const allCoreSandSaves = statKey === 'sandSaves'
      ? await batchAll(ids.map((id) => () => fetchCoreSandSavesPct(id)), BATCH_SIZE)
      : null;

    for (let i = 0; i < ids.length; i++) {
      // sandSaves: use ESPN Core types/2 savePct directly
      if (statKey === 'sandSaves') {
        const pct = allCoreSandSaves?.[i];
        if (pct !== null && pct !== undefined) { playerValues.push({ espnId: ids[i], value: pct }); }
        continue;
      }

      const overview = allOverviewData[i];
      if (!overview) continue;
      const cats = overview.seasonRankings?.categories ?? [];
      const merged = [...cats, ...(overview.summaryStatistics ?? [])];

      // GIR: ESPN stores raw greensHit count, not %; compute from greensHit / (totalDrives × 9)
      if (statKey === 'gir') {
        const pct = computeGirPct(cats);
        if (pct !== null) { playerValues.push({ espnId: ids[i], value: pct }); continue; }
      }

      for (const def of defsForKey) {
        let raw = statNumeric(merged, def.espnName);
        if (raw === null) continue;
        if (def.altMultiplier) raw = raw * def.altMultiplier;
        playerValues.push({ espnId: ids[i], value: raw });
        break;
      }
    }

    console.log(`[stat-lb] statKey=${statKey} pgaPlayers=${ids.length} withValues=${playerValues.length}`);
    if (playerValues.length === 0) return Response.json({ entries: [] });

    playerValues.sort((a, b) =>
      LOWER_IS_BETTER.has(statKey) ? a.value - b.value : b.value - a.value
    );
    const top15 = playerValues.slice(0, 15);

    const names = await Promise.all(top15.map((p) => fetchAthleteName(p.espnId)));

    const entries: StatLeaderboardEntry[] = top15.map((p, i) => ({
      rank: i + 1,
      name: names[i],
      value: formatValue(p.value, statKey),
    })).filter((e) => e.name);

    if (entries.length > 0) {
      try { await redis.setex(cacheKey, 3600, JSON.stringify(entries)); } catch { /* ignore */ }
    }

    // Store tour average (mean of all players with data) for use by tour-averages endpoint
    if (playerValues.length > 0) {
      try {
        const sum = playerValues.reduce((acc, p) => acc + p.value, 0);
        const avg = sum / playerValues.length;
        const avgStr = formatValue(avg, statKey);
        await redis.setex(`${TOUR_AVG_LB_PREFIX}${statKey}`, 3600, avgStr);
        console.log(`[stat-lb] stored tour-avg key=${statKey} avg=${avgStr} n=${playerValues.length}`);
      } catch { /* ignore */ }
    }

    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}
