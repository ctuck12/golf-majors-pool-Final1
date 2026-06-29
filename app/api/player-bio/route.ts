export const dynamic = 'force-dynamic';
import redis from '@/app/lib/redis';
import { getEspnId } from '@/app/lib/espn-player-season';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const ESPN_ATHLETES = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

export type PlayerBio = {
  height: string | null;
  weight: string | null;
  dob: string | null;
  age: number | null;
  college: string | null;
  collegeConfirmedAbsent: boolean;
  swing: string | null;
  turnedPro: number | null;
  pgaTourDebut: number | null;
  careerStarts: number | null;
  careerWins: number | null;
  majorStarts: number | null;
  majorWins: number | null;
  careerEarnings: string | null;
};

function fmtHeight(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const ins = Math.round(totalInches % 12);
  return `${ft}'${ins}"`;
}

function fmtDob(dobStr: string): string | null {
  try {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  } catch { return null; }
}

function calcAge(dobStr: string): number | null {
  try {
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  } catch { return null; }
}

function fmtEarnings(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function parseYear(val: unknown): number | null {
  if (val == null) return null;
  const n = parseInt(String(val));
  return !isNaN(n) && n > 1900 && n < 2100 ? n : null;
}

function parseCount(val: unknown): number | null {
  if (val == null) return null;
  const n = parseInt(String(val));
  return !isNaN(n) && n >= 0 ? n : null;
}

function parseEarnings(val: unknown): string | null {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return !isNaN(n) && n > 0 ? fmtEarnings(n) : null;
}

// ESPN sometimes returns college as { name: "Texas", id: "..." } object
function parseCollege(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val || null;
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    const name = obj.name ?? obj.shortName ?? obj.displayName;
    return name ? String(name) : null;
  }
  return null;
}

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

// PGA Tour GQL: try multiple queries for career bio fields
async function fetchPgaProfileBio(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  // Use the `player` root query (known-working on PGA Tour GQL) for bio/personal data
  const queries = [
    `query Player($id: ID!) {
      player(id: $id) {
        birthDate dateOfBirth height weight college
        turnedPro pgaTourDebutYear
        careerWins careerStarts careerEarnings majorWins majorStarts
      }
    }`,
    `query PlayerHub($id: ID!) {
      playerHub(playerId: $id) {
        player {
          birthDate height weight college turnedPro
          careerWins careerStarts careerEarnings majorWins majorStarts
          pgaTourDebutYear
        }
      }
    }`,
    `query PlayerProfile($id: ID!) {
      playerProfile(playerId: $id) {
        playerBio {
          birthDate dateOfBirth height weight college
          turnedPro turnedProfessional pgaTourDebutYear
          pgaTourWins wins careerWins majorWins
          pgaTourStarts careerStarts majorStarts
          careerEarnings careerMoney
        }
      }
    }`,
    `query PlayerBio($id: ID!) {
      playerBio(playerId: $id) {
        birthDate dateOfBirth height weight college
        turnedPro pgaTourDebutYear
        pgaTourWins wins majorWins
        pgaTourStarts careerStarts majorStarts
        careerEarnings
      }
    }`,
  ];

  for (const query of queries) {
    try {
      const res = await fetch(PGA_GQL, {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({ query, variables: { id: pgaTourId } }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const json = await res.json() as { data?: Record<string, unknown>; errors?: unknown[] };
      if (json.errors?.length) continue;
      const d = json.data;
      if (!d) continue;
      const b: Record<string, unknown> | undefined =
        ((d.playerProfile as Record<string, unknown>)?.playerBio as Record<string, unknown> | undefined)
        ?? (d.playerBio as Record<string, unknown> | undefined)
        ?? (d.playerProfile as Record<string, unknown> | undefined);
      if (!b) continue;

      const dob = (b.birthDate ?? b.dateOfBirth) as string | undefined;
      if (dob && !result.dob) { result.dob = fmtDob(dob); result.age = calcAge(dob); }

      const h = b.height as number | string | undefined;
      if (h != null && !result.height) {
        const hNum = parseFloat(String(h));
        result.height = !isNaN(hNum) && hNum > 48 ? fmtHeight(hNum) : (typeof h === 'string' ? h : null);
      }
      const w = b.weight as number | string | undefined;
      if (w != null && !result.weight) {
        const wNum = parseFloat(String(w).replace(/[^\d.]/g, ''));
        result.weight = !isNaN(wNum) && wNum > 100 ? `${Math.round(wNum)} lbs` : null;
      }

      if (!result.college) result.college = parseCollege(b.college);
      const tp = (b.turnedPro ?? b.turnedProfessional) as unknown;
      if (tp != null && !result.turnedPro) result.turnedPro = parseYear(tp);
      const debut = (b.pgaTourDebutYear ?? b.debutYear) as unknown;
      if (debut != null && !result.pgaTourDebut) result.pgaTourDebut = parseYear(debut);
      const wins = (b.pgaTourWins ?? b.wins ?? b.careerWins) as unknown;
      if (wins != null && result.careerWins == null) result.careerWins = parseCount(wins);
      const mw = b.majorWins as unknown;
      if (mw != null && result.majorWins == null) result.majorWins = parseCount(mw);
      const starts = (b.pgaTourStarts ?? b.careerStarts ?? b.events) as unknown;
      if (starts != null && result.careerStarts == null) result.careerStarts = parseCount(starts);
      const ms = b.majorStarts as unknown;
      if (ms != null && result.majorStarts == null) result.majorStarts = parseCount(ms);
      const earnings = (b.careerEarnings ?? b.careerMoney) as unknown;
      if (earnings != null && !result.careerEarnings) result.careerEarnings = parseEarnings(earnings);

      // If we got any data, stop trying more queries
      if (Object.values(result).some(v => v != null)) break;
    } catch { /* try next */ }
  }
  return result;
}

// ESPN athlete profile — DOB, height, weight, college, proYear
async function fetchEspnProfile(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const res = await fetch(`${ESPN_ATHLETES}/${espnId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const data = await res.json() as Record<string, unknown>;
    const a = (data?.athlete ?? data) as Record<string, unknown>;
    if (!a) return result;

    const h = (a.height ?? a.displayHeight) as number | string | undefined;
    if (h != null) {
      const hNum = parseFloat(String(h));
      if (!isNaN(hNum) && hNum > 48 && hNum < 96) result.height = fmtHeight(hNum);
      else if (typeof h === 'string' && h.includes("'")) result.height = h;
    }

    const w = (a.weight ?? a.displayWeight) as number | string | undefined;
    if (w != null) {
      const wNum = parseFloat(String(w).replace(/[^\d.]/g, ''));
      if (!isNaN(wNum) && wNum > 100 && wNum < 400) result.weight = `${Math.round(wNum)} lbs`;
      else if (typeof w === 'string' && w.toLowerCase().includes('lbs')) result.weight = w;
    }

    const dob = (a.dateOfBirth ?? a.birthDate ?? a.dob) as string | undefined;
    if (dob) { result.dob = fmtDob(dob); result.age = calcAge(dob); }

    // College comes back as an object { name: "Texas", id: "..." } from ESPN,
    // or as a $ref-only object { "$ref": "https://sports.core.api.espn.com/v2/colleges/123" }
    const collegeRaw = a.college ?? a.collegeName;
    result.college = parseCollege(collegeRaw);
    if (!result.college && typeof collegeRaw === 'object' && collegeRaw !== null) {
      const ref = (collegeRaw as Record<string, unknown>).$ref as string | undefined;
      if (ref && ref.includes('espn.com')) {
        try {
          const cr = await fetch(ref, { signal: AbortSignal.timeout(3000) });
          if (cr.ok) {
            const cd = await cr.json() as Record<string, unknown>;
            result.college = parseCollege(cd) ?? (cd.name ? String(cd.name) : null);
          }
        } catch { /* ignore */ }
      }
    }

    const proYear = (a.proYear ?? a.turnedPro ?? a.debutYear) as unknown;
    if (proYear != null) result.turnedPro = parseYear(proYear);

    // Handedness / swing hand — ESPN returns numeric (1=Right,2=Left), string "R"/"L", or object
    const parseHand = (val: unknown): string | null => {
      if (val == null) return null;
      if (typeof val === 'number') return val === 1 ? 'Right' : val === 2 ? 'Left' : null;
      if (typeof val === 'string') {
        const h = val.toLowerCase();
        if (h === 'r' || h === '1' || h.includes('right')) return 'Right';
        if (h === 'l' || h === '2' || h.includes('left')) return 'Left';
      }
      if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>;
        // { id: 1, text: "Right" } or { type: "right-handed" } or { displayValue: "Right-Handed" }
        const text = String(obj.text ?? obj.displayValue ?? obj.type ?? obj.id ?? '').toLowerCase();
        if (text.includes('right') || text === '1') return 'Right';
        if (text.includes('left') || text === '2') return 'Left';
      }
      return null;
    };
    const swing = parseHand(a.hand ?? a.handedness ?? a.throws ?? a.batting ?? a.hitting);
    if (swing) result.swing = swing;

    // If the ESPN athlete fetch succeeded and returned data but no college found,
    // treat as confirmed absent (ESPN includes college for players who attended).
    if (!result.college && result.dob) result.collegeConfirmedAbsent = true;

    // Career wins/earnings sometimes on the athlete profile
    const wins = (a.wins ?? a.careerWins ?? a.totalWins) as unknown;
    if (wins != null) result.careerWins = parseCount(wins);
    const earnings = (a.earnings ?? a.careerEarnings ?? a.totalEarnings) as unknown;
    if (earnings != null) result.careerEarnings = parseEarnings(earnings);
  } catch { /* ignore */ }
  return result;
}

// ESPN Core athlete endpoint — may have college $ref and career data
async function fetchEspnCoreAthlete(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const res = await fetch(`${ESPN_CORE}/athletes/${espnId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const a = await res.json() as Record<string, unknown>;

    if (!result.college) {
      const collegeRaw = a.college ?? a.collegeName;
      result.college = parseCollege(collegeRaw);
      if (!result.college && typeof collegeRaw === 'object' && collegeRaw !== null) {
        const ref = (collegeRaw as Record<string, unknown>).$ref as string | undefined;
        if (ref && ref.includes('espn.com')) {
          try {
            const cr = await fetch(ref, { signal: AbortSignal.timeout(3000) });
            if (cr.ok) {
              const cd = await cr.json() as Record<string, unknown>;
              result.college = parseCollege(cd) ?? (cd.name ? String(cd.name) : null);
            }
          } catch { /* ignore */ }
        }
      }
    }

    const dob = (a.dateOfBirth ?? a.birthDate) as string | undefined;
    if (dob && !result.dob) { result.dob = fmtDob(dob); result.age = calcAge(dob); }

    const h = (a.height ?? a.displayHeight) as number | string | undefined;
    if (h != null && !result.height) {
      const hNum = parseFloat(String(h));
      if (!isNaN(hNum) && hNum > 48 && hNum < 96) result.height = fmtHeight(hNum);
    }

    const w = (a.weight ?? a.displayWeight) as number | string | undefined;
    if (w != null && !result.weight) {
      const wNum = parseFloat(String(w).replace(/[^\d.]/g, ''));
      if (!isNaN(wNum) && wNum > 100 && wNum < 400) result.weight = `${Math.round(wNum)} lbs`;
    }

    const proYear = (a.proYear ?? a.turnedPro) as unknown;
    if (proYear != null && !result.turnedPro) result.turnedPro = parseYear(proYear);

    if (!result.swing) {
      const handRaw = a.hand ?? a.handedness;
      if (handRaw != null) {
        if (typeof handRaw === 'number') result.swing = handRaw === 1 ? 'Right' : handRaw === 2 ? 'Left' : null;
        else if (typeof handRaw === 'string') {
          const h = handRaw.toLowerCase();
          if (h === 'r' || h === '1' || h.includes('right')) result.swing = 'Right';
          else if (h === 'l' || h === '2' || h.includes('left')) result.swing = 'Left';
        } else if (typeof handRaw === 'object') {
          const obj = handRaw as Record<string, unknown>;
          const text = String(obj.text ?? obj.displayValue ?? obj.type ?? obj.id ?? '').toLowerCase();
          if (text.includes('right') || text === '1') result.swing = 'Right';
          else if (text.includes('left') || text === '2') result.swing = 'Left';
        }
      }
    }

    if (!result.college && result.dob) result.collegeConfirmedAbsent = true;
  } catch { /* ignore */ }
  return result;
}

// ESPN Core athlete statistics (career-level, no season filter) — wins, starts, earnings
async function fetchEspnCoreCareerStats(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  const year = new Date().getFullYear();
  // Try career-level endpoints (no season) and current season for totals
  const urls = [
    `${ESPN_CORE}/athletes/${espnId}/statistics`,
    `${ESPN_CORE}/athletes/${espnId}/statistics/0`,
    `${ESPN_CORE}/seasons/${year}/athletes/${espnId}/statistics`,
    `${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json() as Record<string, unknown>;

      // Look for career splits or top-level career fields
      const splits = (data?.splits as Array<Record<string, unknown>>) ?? [];
      for (const split of splits) {
        const splitName = String(split.displayName ?? split.name ?? '').toLowerCase();
        if (!splitName.includes('career')) continue;
        const cats = (split.categories as Array<Record<string, unknown>>) ?? [];
        for (const cat of cats) {
          const stats = (cat.stats as Array<Record<string, unknown>>) ?? [];
          for (const s of stats) {
            const n = String(s.name ?? '').toLowerCase();
            const dv = s.displayValue as string | undefined;
            if (!dv || dv === '-' || dv === '--') continue;
            if (n.includes('win') && result.careerWins == null) result.careerWins = parseCount(dv);
            if ((n.includes('start') || n.includes('event') || n.includes('round')) && result.careerStarts == null) result.careerStarts = parseCount(dv);
            if ((n.includes('earn') || n.includes('money') || n.includes('prize')) && result.careerEarnings == null) result.careerEarnings = parseEarnings(dv);
          }
        }
      }

      if (Object.values(result).some(v => v != null)) break;
    } catch { /* try next */ }
  }
  return result;
}

// ESPN statisticslog — sum all seasons to get true career totals
async function fetchEspnCareerTotals(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const logRes = await fetch(
      `${ESPN_CORE}/athletes/${espnId}/statisticslog`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!logRes.ok) return result;
    const logData = await logRes.json() as { entries?: Array<{ statistics?: Array<{ statistics?: { $ref?: string } }> }> };
    const entries = logData?.entries ?? [];

    // Collect all season stat $refs (type 2 = stroke play) and extract year from URL
    const refs: { url: string; year: number | null }[] = [];
    for (const entry of entries) {
      for (const stat of entry.statistics ?? []) {
        const ref = stat?.statistics?.$ref;
        if (ref && ref.includes('/types/2/')) {
          const yearMatch = ref.match(/\/seasons\/(\d{4})\//);
          refs.push({ url: ref, year: yearMatch ? parseInt(yearMatch[1]) : null });
        }
      }
    }
    if (refs.length === 0) return result;

    // Derive earliest pro year from URLs alone (no fetch needed for this)
    const years = refs.map(r => r.year).filter((y): y is number => y != null);
    if (years.length > 0) result.turnedPro = Math.min(...years);

    // Fetch all season stat pages in parallel
    const pages = await Promise.allSettled(
      refs.map(r => fetch(r.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(res => res.ok ? res.json() : null))
    );

    let totalStarts = 0, totalWins = 0, totalEarnings = 0;

    for (const p of pages) {
      if (p.status !== 'fulfilled' || !p.value) continue;
      const data = p.value as { splits?: { categories?: Array<{ stats?: Array<{ name?: string; value?: number; displayValue?: string }> }> } };
      const cats = data?.splits?.categories ?? [];
      for (const cat of cats) {
        for (const s of cat.stats ?? []) {
          const n = (s.name ?? '').toLowerCase();
          const v = s.value ?? 0;
          if (n === 'tournamentsplayed' || n === 'eventsplayed') totalStarts += v;
          else if (n === 'wins') totalWins += v;
          else if (n === 'officialamount' || n === 'earnings') totalEarnings += v;
        }
      }
    }

    if (totalStarts > 0) result.careerStarts = totalStarts;
    if (totalWins >= 0 && totalStarts > 0) result.careerWins = totalWins;
    if (totalEarnings > 0) result.careerEarnings = fmtEarnings(totalEarnings);
  } catch { /* ignore */ }
  return result;
}

// PGA Tour GQL: playerProfileMajorResults — major starts and wins
// MajorResultsTournament fields confirmed: tournamentId, tournamentName, courseName,
// date, year, position, roundScores, total, toPar, money, tourcastURI
async function fetchPgaMajorResults(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const query = `
      query MajorResults($id: String!) {
        playerProfileMajorResults(playerId: $id) {
          tournaments {
            year
            position
          }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables: { id: pgaTourId } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return result;
    const json = await res.json() as {
      data?: {
        playerProfileMajorResults?: {
          tournaments?: Array<{ year?: unknown; position?: unknown }>;
        };
      };
      errors?: unknown[];
    };
    if (json.errors?.length) return result;
    const tournaments = json.data?.playerProfileMajorResults?.tournaments ?? [];
    if (tournaments.length === 0) return result;

    // Each entry = one major appearance; position "1" = win
    result.majorStarts = tournaments.length;
    result.majorWins = tournaments.filter(t => {
      const pos = String(t.position ?? '').trim();
      return pos === '1' || pos === 'W' || pos === 'P1';
    }).length;
  } catch { /* ignore */ }
  return result;
}

// ESPN athlete overview — career splits for wins/starts/earnings
async function fetchEspnOverviewCareer(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const res = await fetch(`${ESPN_ATHLETES}/${espnId}/overview`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const data = await res.json() as Record<string, unknown>;

    const athleteNode = data?.athlete as Record<string, unknown> | undefined;
    const statistics = (data?.statistics ?? athleteNode?.statistics) as Record<string, unknown> | undefined;
    if (!statistics) return result;

    const names = (statistics.names as string[]) ?? [];
    const splits = (statistics.splits as Array<Record<string, unknown>>) ?? [];

    const careerSplit = splits.find(s =>
      String(s.displayName ?? s.name ?? '').toLowerCase().includes('career')
    );

    if (careerSplit && names.length > 0) {
      const stats = (careerSplit.stats as unknown[]) ?? [];
      names.forEach((statName, i) => {
        const val = stats[i];
        if (val == null || val === '' || val === '-' || val === '--') return;
        const n = statName.toLowerCase();
        if ((n.includes('win') || n === 'w') && result.careerWins == null) result.careerWins = parseCount(val);
        if ((n.includes('start') || n.includes('event') || n === 'g') && result.careerStarts == null) result.careerStarts = parseCount(val);
        if ((n.includes('earn') || n.includes('money') || n.includes('prize')) && result.careerEarnings == null) result.careerEarnings = parseEarnings(val);
      });
    }
  } catch { /* ignore */ }
  return result;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  const pgaTourId = url.searchParams.get('pgaTourId') ?? '';
  if (!name) return Response.json({ bio: null });

  const cacheKey = `player-bio:v12:${name}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const espnId = await getEspnId(name).catch(() => null);
      const espnPhotoUrl = espnId ? `https://a.espncdn.com/i/headshots/golf/players/full/${espnId}.png` : null;
      return Response.json({ bio: JSON.parse(cached as string), espnPhotoUrl });
    }
  } catch { /* ignore */ }

  const bio: PlayerBio = {
    height: null, weight: null, dob: null, age: null,
    college: null, collegeConfirmedAbsent: false, swing: null,
    turnedPro: null, pgaTourDebut: null,
    careerStarts: null, careerWins: null, majorStarts: null,
    majorWins: null, careerEarnings: null,
  };

  function merge(partial: Partial<PlayerBio>) {
    for (const [k, v] of Object.entries(partial)) {
      if (v != null && (bio as Record<string, unknown>)[k] == null) {
        (bio as Record<string, unknown>)[k] = v;
      }
    }
  }

  const espnId = await getEspnId(name).catch(() => null);

  const fetches: Promise<Partial<PlayerBio>>[] = [];
  if (pgaTourId) {
    fetches.push(fetchPgaProfileBio(pgaTourId));
    fetches.push(fetchPgaMajorResults(pgaTourId));
  }
  if (espnId) {
    fetches.push(fetchEspnProfile(espnId));
    fetches.push(fetchEspnCoreAthlete(espnId));
    fetches.push(fetchEspnOverviewCareer(espnId));
    fetches.push(fetchEspnCoreCareerStats(espnId));
    fetches.push(fetchEspnCareerTotals(espnId));
  }

  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === 'fulfilled') merge(r.value);
  }

  try { await redis.setex(cacheKey, 86400, JSON.stringify(bio)); } catch { /* ignore */ }
  const espnPhotoUrl = espnId
    ? `https://a.espncdn.com/i/headshots/golf/players/full/${espnId}.png`
    : null;
  return Response.json({ bio, espnPhotoUrl });
}
