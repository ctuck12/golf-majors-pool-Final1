export const dynamic = 'force-dynamic';
import redis from '@/app/lib/redis';
import { getEspnId } from '@/app/lib/espn-player-season';

const ESPN_ATHLETES = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

export type PlayerBio = {
  height: string | null;
  weight: string | null;
  dob: string | null;
  age: number | null;
  college: string | null;
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

// ESPN athlete profile endpoint — has DOB, height, weight, college, proYear
async function fetchEspnProfile(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const res = await fetch(`${ESPN_ATHLETES}/${espnId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const data = await res.json() as Record<string, unknown>;
    // Response is { athlete: { id, displayName, height, weight, dateOfBirth, college, proYear, ... } }
    const a = (data?.athlete ?? data) as Record<string, unknown>;
    if (!a) return result;

    // Height: ESPN returns total inches as a number (e.g. 73 = 6'1")
    const h = a.height ?? a.displayHeight;
    if (h != null) {
      const hNum = parseFloat(String(h));
      if (!isNaN(hNum) && hNum > 48 && hNum < 96) {
        result.height = fmtHeight(hNum);
      } else if (typeof h === 'string' && h.includes("'")) {
        result.height = h; // already formatted like "6'1""
      }
    }

    // Weight: ESPN returns lbs as a number
    const w = a.weight ?? a.displayWeight;
    if (w != null) {
      const wStr = String(w).replace(/[^\d.]/g, '');
      const wNum = parseFloat(wStr);
      if (!isNaN(wNum) && wNum > 100 && wNum < 400) result.weight = `${Math.round(wNum)} lbs`;
      else if (typeof w === 'string' && w.toLowerCase().includes('lbs')) result.weight = w;
    }

    // Date of birth
    const dob = (a.dateOfBirth ?? a.birthDate ?? a.dob) as string | undefined;
    if (dob) { result.dob = fmtDob(dob); result.age = calcAge(dob); }

    // College
    const college = a.college ?? a.collegeName;
    if (college) result.college = String(college);

    // Turned pro year
    const proYear = a.proYear ?? a.turnedPro ?? a.debutYear;
    if (proYear != null) result.turnedPro = parseYear(proYear);

    // Career wins (sometimes in athlete profile)
    const wins = a.wins ?? a.careerWins ?? a.totalWins;
    if (wins != null) result.careerWins = parseCount(wins);

    // Career earnings (sometimes in athlete profile)
    const earnings = a.earnings ?? a.careerEarnings ?? a.totalEarnings;
    if (earnings != null) result.careerEarnings = parseEarnings(earnings);
  } catch { /* ignore */ }
  return result;
}

// ESPN Core athlete bio endpoint — alternative source for profile data
async function fetchEspnCoreBio(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const res = await fetch(`${ESPN_CORE}/athletes/${espnId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const data = await res.json() as Record<string, unknown>;

    const h = data.height ?? data.displayHeight;
    if (h != null) {
      const hNum = parseFloat(String(h));
      if (!isNaN(hNum) && hNum > 48 && hNum < 96) result.height = fmtHeight(hNum);
    }
    const w = data.weight ?? data.displayWeight;
    if (w != null) {
      const wNum = parseFloat(String(w).replace(/[^\d.]/g, ''));
      if (!isNaN(wNum) && wNum > 100 && wNum < 400) result.weight = `${Math.round(wNum)} lbs`;
    }
    const dob = (data.dateOfBirth ?? data.birthDate) as string | undefined;
    if (dob) { result.dob = fmtDob(dob); result.age = calcAge(dob); }
    if (data.college) result.college = String(data.college);
    const proYear = data.proYear ?? data.turnedPro;
    if (proYear != null) result.turnedPro = parseYear(proYear);
  } catch { /* ignore */ }
  return result;
}

// ESPN athlete overview endpoint — has career splits with wins/starts/earnings
async function fetchEspnOverviewStats(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const res = await fetch(`${ESPN_ATHLETES}/${espnId}/overview`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const data = await res.json() as Record<string, unknown>;

    // Statistics can be at data.statistics or data.athlete.statistics
    const athleteNode = data?.athlete as Record<string, unknown> | undefined;
    const statistics = (data?.statistics ?? athleteNode?.statistics) as Record<string, unknown> | undefined;
    if (!statistics) return result;

    const names = (statistics.names as string[]) ?? [];
    const splits = (statistics.splits as Array<Record<string, unknown>>) ?? [];

    // Find career split (may be named "Career" or similar)
    const careerSplit = splits.find((s) =>
      String(s.displayName ?? s.name ?? '').toLowerCase().includes('career')
    ) ?? splits.find((s) =>
      String(s.type ?? '').toLowerCase().includes('career')
    );

    if (careerSplit && names.length > 0) {
      const stats = (careerSplit.stats as unknown[]) ?? [];
      names.forEach((statName, i) => {
        const val = stats[i];
        if (val == null || val === '' || val === '-' || val === '--') return;
        const n = statName.toLowerCase();
        if ((n.includes('win') || n === 'w') && result.careerWins == null) {
          result.careerWins = parseCount(val);
        }
        if ((n.includes('start') || n.includes('event') || n === 'g') && result.careerStarts == null) {
          result.careerStarts = parseCount(val);
        }
        if ((n.includes('earn') || n.includes('money') || n.includes('prize')) && result.careerEarnings == null) {
          result.careerEarnings = parseEarnings(val);
        }
      });
    }

    // Also try seasonRankings.categories for career stats
    const catNode = (data?.seasonRankings ?? athleteNode?.seasonRankings) as Record<string, unknown> | undefined;
    const cats = (catNode?.categories as Array<Record<string, unknown>>) ?? [];
    for (const cat of cats) {
      const catName = String(cat.name ?? cat.displayName ?? '').toLowerCase();
      const catStats = (cat.stats as Array<Record<string, unknown>>) ?? [];
      for (const s of catStats) {
        const sName = String(s.name ?? '').toLowerCase();
        const dv = s.displayValue as string | undefined;
        if (!dv || dv === '-' || dv === '--' || dv === '0') continue;
        if (catName.includes('career') || sName.includes('career')) {
          if (sName.includes('win') && result.careerWins == null) result.careerWins = parseCount(dv);
          if ((sName.includes('start') || sName.includes('event')) && result.careerStarts == null) result.careerStarts = parseCount(dv);
          if ((sName.includes('earn') || sName.includes('money')) && result.careerEarnings == null) result.careerEarnings = parseEarnings(dv);
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  if (!name) return Response.json({ bio: null });

  const cacheKey = `player-bio:v4:${name}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ bio: JSON.parse(cached as string) });
  } catch { /* ignore */ }

  const bio: PlayerBio = {
    height: null, weight: null, dob: null, age: null,
    college: null, turnedPro: null, pgaTourDebut: null,
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
  if (espnId) {
    const [profile, core, overview] = await Promise.all([
      fetchEspnProfile(espnId),
      fetchEspnCoreBio(espnId),
      fetchEspnOverviewStats(espnId),
    ]);
    merge(profile);
    merge(core);
    merge(overview);
  }

  try { await redis.setex(cacheKey, 86400, JSON.stringify(bio)); } catch { /* ignore */ }
  return Response.json({ bio });
}
