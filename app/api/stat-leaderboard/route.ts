export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const TOUR_AVG_LB_PREFIX = 'tour-avg:lb:v1:';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const BATCH_SIZE = 25;
const CURRENT_YEAR = new Date().getFullYear();
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

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

// Fetch stats from ESPN Core types/2 — returns the full stats array
// Fetch stats array from ESPN Core types/2 — shared helper for sandSaves and scrambling
async function fetchCoreStats(espnId: string): Promise<Stat[] | null> {
  try {
    const url = `${ESPN_CORE}/seasons/${CURRENT_YEAR}/types/2/athletes/${espnId}/statistics/0`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as {
      splits?: { categories?: Array<{ stats?: Stat[] }> } | Array<{ stats?: Stat[] }>;
    };
    if (data?.splits && !Array.isArray(data.splits)) {
      return (data.splits as { categories?: Array<{ stats?: Stat[] }> }).categories?.[0]?.stats ?? null;
    }
    if (Array.isArray(data?.splits)) {
      return (data.splits as Array<{ stats?: Stat[] }>)[0]?.stats ?? null;
    }
    return null;
  } catch { return null; }
}

// Fetch savePct (sand saves %) from ESPN Core types/2 — only reliable source for this stat
async function fetchCoreSandSavesPct(espnId: string): Promise<number | null> {
  const stats = await fetchCoreStats(espnId);
  if (!stats) return null;
  const s = stats.find((x) => x.name === 'savePct');
  if (s?.value && !isNaN(s.value) && s.value > 0) return s.value;
  const dv = parseFloat(s?.displayValue ?? '');
  if (!isNaN(dv) && dv > 0) return dv;
  return null;
}

let _scramblingStatNameLogged = false;

// Fetch scrambling % from ESPN Core types/2 — ESPN overview returns 0 for this stat
async function fetchCoreScrambling(espnId: string): Promise<number | null> {
  const stats = await fetchCoreStats(espnId);
  if (!stats) return null;
  // Log all stat names once so we can discover the correct scrambling stat name in Vercel logs
  if (!_scramblingStatNameLogged) {
    _scramblingStatNameLogged = true;
    console.log(`[scrambling-debug espnId=${espnId}] Core types/2 stat names+values: ${stats.map((s) => `${s.name}=${s.value}`).join(', ')}`);
  }
  const NAMES = [
    'scramblingPct', 'scrambling', 'scramblePct', 'scrmblPct',
    'upAndDown', 'upAndDownPct', 'upAndDownConventional',
    'parSave', 'parSavePct', 'parSaves', 'conventionalScrambling',
    'scrambles', 'scramblesTotal', 'scramblingConventional',
  ];
  for (const name of NAMES) {
    const s = stats.find((x) => x.name === name);
    if (!s) continue;
    const raw = (s.value !== undefined && s.value !== null && s.value !== 0)
      ? s.value
      : parseFloat(s.averageDisplayValue ?? s.displayValue ?? '');
    if (!raw || isNaN(raw) || raw === 0) continue;
    if (raw > 0 && raw < 1) return raw * 100;
    if (raw >= 30 && raw <= 100) return raw;
  }
  // Broad regex fallback: any stat name containing 'scrambl' (case-insensitive)
  for (const s of stats) {
    if (!s.name || !/scrambl/i.test(s.name)) continue;
    const raw = (s.value !== undefined && s.value !== null && s.value !== 0)
      ? s.value
      : parseFloat(s.averageDisplayValue ?? s.displayValue ?? '');
    if (!raw || isNaN(raw) || raw === 0) continue;
    console.log(`[scrambling-debug] regex match: name=${s.name} raw=${raw}`);
    if (raw > 0 && raw < 1) return raw * 100;
    if (raw >= 30 && raw <= 100) return raw;
  }
  return null;
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

// Fetch all rows from PGA Tour GQL statDetails for a given stat ID.
// Returns entries sorted by rank with name and numeric value already parsed,
// plus the official tour average from the StatDetailTourAvg row if present.
async function fetchStatDetailsLeaderboard(statId: string): Promise<{ players: Array<{ name: string; value: number }>; officialTourAvg: number | null } | null> {
  try {
    const query = `
      query StatDetails($statId: String!) {
        statDetails(tourCode: R, statId: $statId) {
          rows {
            ... on StatDetailsPlayer {
              playerName
              rank
              stats {
                ... on CategoryPlayerStat {
                  statName
                  statValue
                }
              }
            }
            ... on StatDetailTourAvg {
              displayName
              value
            }
          }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: { statDetails?: { rows?: Array<{ playerName?: string; rank?: number; stats?: Array<{ statName?: string; statValue?: string }>; displayName?: string; value?: string }> } };
    };
    const rows = data?.data?.statDetails?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const entries: Array<{ name: string; rank: number; value: number }> = [];
    let officialTourAvg: number | null = null;
    for (const row of rows) {
      if (!row.playerName) {
        // StatDetailTourAvg row — extract official tour average
        if (row.value) {
          const avg = parseFloat(row.value.replace('%', ''));
          if (!isNaN(avg) && avg !== 0) officialTourAvg = avg;
        }
        continue;
      }
      const statValue = row.stats?.[0]?.statValue ?? '';
      const value = parseFloat(statValue.replace('%', ''));
      if (!isNaN(value) && value !== 0) {
        entries.push({ name: row.playerName, rank: row.rank ?? 9999, value });
      }
    }
    entries.sort((a, b) => a.rank - b.rank);
    return entries.length > 0 ? { players: entries.map(({ name, value }) => ({ name, value })), officialTourAvg } : null;
  } catch { return null; }
}

// PGA Tour stat IDs for each stat key — statDetails covers the full tour field (~155 players)
const STAT_DETAILS_IDS: Record<string, string[]> = {
  drivingDistance: ['101'],
  drivingAccuracy: ['102'],
  gir: ['103'],
  puttAverage: ['104'],
  scoringAverage: ['108'],
  scrambling: ['130', '106'],
  sandSaves: ['111', '107'],
  sgTotal: ['02674'],
  sgTeeToGreen: ['02675'],
  sgOffTee: ['02567'],
  sgApproach: ['02568'],
  sgAroundGreen: ['02569'],
  sgPutting: ['02564'],
};

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

  const cacheKey = `stat-lb:v24:${statKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) { const parsed = JSON.parse(cached); return Response.json(Array.isArray(parsed) ? { entries: parsed, tourAvg: null } : parsed); }
  } catch { /* ignore */ }

  try {
    // Try PGA Tour statDetails first — covers the full tour field (~155 players) for all stats
    const pgaStatIds = STAT_DETAILS_IDS[statKey];
    if (pgaStatIds) {
      let gqlResult: { players: Array<{ name: string; value: number }>; officialTourAvg: number | null } | null = null;
      for (const id of pgaStatIds) {
        gqlResult = await fetchStatDetailsLeaderboard(id);
        if (gqlResult && gqlResult.players.length > 0) break;
      }
      if (gqlResult && gqlResult.players.length > 0) {
        const def = statDefs.find((d) => d.key === statKey);
        const isPercent = def?.isPercent ?? false;
        const decimals = def?.decimals ?? 1;
        const fmt = (v: number) => isPercent ? `${v.toFixed(decimals)}%` : v.toFixed(decimals);
        // Use official PGA Tour average if available; fall back to computed mean
        const avgNum = gqlResult.officialTourAvg !== null
          ? gqlResult.officialTourAvg
          : gqlResult.players.reduce((s, r) => s + r.value, 0) / gqlResult.players.length;
        const tourAvg = fmt(avgNum);
        const entries: StatLeaderboardEntry[] = gqlResult.players.map((r, i) => ({ rank: i + 1, name: r.name, value: fmt(r.value) }));
        try { await redis.setex(cacheKey, 3600, JSON.stringify({ entries, tourAvg })); } catch { /* ignore */ }
        try { await redis.setex(`${TOUR_AVG_LB_PREFIX}${statKey}`, 3600, tourAvg); } catch { /* ignore */ }
        return Response.json({ entries, tourAvg });
      }
    }

    // Fallback: ESPN overview (covers ~116 major-event players)
    const ids = await fetchPgaPlayerIds();
    if (ids.length === 0) return Response.json({ entries: [] });

    const defsForKey = statDefs.filter((d) => d.key === statKey);
    const playerValues: Array<{ espnId: string; value: number }> = [];

    const allOverviewData = await batchAll(
      ids.map((id) => () => fetchAthleteOverviewStats(id)),
      BATCH_SIZE,
    );

    for (let i = 0; i < ids.length; i++) {
      const overview = allOverviewData[i];
      if (!overview) continue;
      const cats = overview.seasonRankings?.categories ?? [];
      const merged = [...cats, ...(overview.summaryStatistics ?? [])];

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

    console.log(`[stat-lb] statKey=${statKey} espn-fallback players=${ids.length} withValues=${playerValues.length}`);
    if (playerValues.length === 0) return Response.json({ entries: [] });

    playerValues.sort((a, b) =>
      LOWER_IS_BETTER.has(statKey) ? a.value - b.value : b.value - a.value
    );

    const names = await Promise.all(playerValues.map((p) => fetchAthleteName(p.espnId)));

    const entries: StatLeaderboardEntry[] = playerValues.map((p, i) => ({
      rank: i + 1,
      name: names[i],
      value: formatValue(p.value, statKey),
    })).filter((e) => e.name);

    // Store tour average (mean of all players with data) for use by tour-averages endpoint
    let tourAvg: string | null = null;
    if (playerValues.length > 0) {
      try {
        const sum = playerValues.reduce((acc, p) => acc + p.value, 0);
        const avg = sum / playerValues.length;
        tourAvg = formatValue(avg, statKey);
        await redis.setex(`${TOUR_AVG_LB_PREFIX}${statKey}`, 3600, tourAvg);
        console.log(`[stat-lb] stored tour-avg key=${statKey} avg=${tourAvg} n=${playerValues.length}`);
      } catch { /* ignore */ }
    }

    if (entries.length > 0) {
      try { await redis.setex(cacheKey, 3600, JSON.stringify({ entries, tourAvg })); } catch { /* ignore */ }
    }

    return Response.json({ entries, tourAvg });
  } catch {
    return Response.json({ entries: [] });
  }
}
