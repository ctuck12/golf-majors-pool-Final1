export const dynamic = 'force-dynamic';
import redis from '@/app/lib/redis';
import { getEspnId } from '@/app/lib/espn-player-season';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const ESPN_ATHLETES = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';

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

function fmtHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const ins = inches % 12;
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

function parseEarningsStr(val: unknown): string | null {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) || n <= 0 ? null : fmtEarnings(n);
}

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

async function fetchPgaBio(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    // playerProfile is a known-working GQL query on PGA Tour's orchestrator
    const query = `
      query PlayerProfile($playerId: ID!) {
        playerProfile(playerId: $playerId) {
          playerBio {
            birthDate
            height
            weight
            college
            turnedPro
            pgaTourWins
            majorWins
            pgaTourStarts
            majorStarts
            careerEarnings
            pgaTourDebutYear
          }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables: { playerId: pgaTourId } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const json = await res.json() as { data?: { playerProfile?: { playerBio?: Record<string, unknown> } } };
    const b = json?.data?.playerProfile?.playerBio;
    if (!b) return result;

    const dobRaw = (b.birthDate ?? b.dateOfBirth) as string | undefined;
    if (dobRaw) { result.dob = fmtDob(dobRaw); result.age = calcAge(dobRaw); }

    const h = b.height as number | string | undefined;
    if (h != null) {
      const hNum = typeof h === 'number' ? h : parseFloat(String(h));
      result.height = isNaN(hNum) ? String(h) : fmtHeight(hNum);
    }

    const w = b.weight as number | string | undefined;
    if (w != null) {
      const wNum = typeof w === 'number' ? w : parseFloat(String(w));
      result.weight = isNaN(wNum) ? String(w) : `${Math.round(wNum)} lbs`;
    }

    if (b.college) result.college = String(b.college);

    const tp = (b.turnedPro ?? b.turnedProfessional) as number | string | undefined;
    if (tp != null) { const n = parseInt(String(tp)); if (!isNaN(n) && n > 1900) result.turnedPro = n; }

    const debut = (b.pgaTourDebutYear ?? b.debutYear) as number | string | undefined;
    if (debut != null) { const n = parseInt(String(debut)); if (!isNaN(n) && n > 1900) result.pgaTourDebut = n; }

    const earnings = (b.careerEarnings ?? b.careerMoney) as unknown;
    if (earnings != null) result.careerEarnings = parseEarningsStr(earnings);

    const wins = (b.pgaTourWins ?? b.careerWins ?? b.wins) as number | string | undefined;
    if (wins != null) { const n = parseInt(String(wins)); if (!isNaN(n) && n >= 0) result.careerWins = n; }

    const starts = (b.pgaTourStarts ?? b.careerStarts ?? b.events) as number | string | undefined;
    if (starts != null) { const n = parseInt(String(starts)); if (!isNaN(n) && n >= 0) result.careerStarts = n; }

    const mw = b.majorWins as number | string | undefined;
    if (mw != null) { const n = parseInt(String(mw)); if (!isNaN(n) && n >= 0) result.majorWins = n; }

    const ms = b.majorStarts as number | string | undefined;
    if (ms != null) { const n = parseInt(String(ms)); if (!isNaN(n) && n >= 0) result.majorStarts = n; }
  } catch { /* ignore */ }
  return result;
}

async function fetchPgaBioFlat(pgaTourId: string): Promise<Partial<PlayerBio>> {
  // Fallback: try playerBio as a top-level query (some schema versions)
  const result: Partial<PlayerBio> = {};
  try {
    const query = `
      query PlayerBio($playerId: ID!) {
        playerBio(playerId: $playerId) {
          birthDate
          height
          weight
          college
          turnedPro
          pgaTourWins
          majorWins
          pgaTourStarts
          majorStarts
          careerEarnings
          pgaTourDebutYear
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables: { playerId: pgaTourId } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return result;
    const json = await res.json() as { data?: { playerBio?: Record<string, unknown> } };
    const b = json?.data?.playerBio;
    if (!b) return result;

    const dobRaw = (b.birthDate ?? b.dateOfBirth) as string | undefined;
    if (dobRaw) { result.dob = fmtDob(dobRaw); result.age = calcAge(dobRaw); }

    const h = b.height as number | string | undefined;
    if (h != null) {
      const hNum = typeof h === 'number' ? h : parseFloat(String(h));
      result.height = isNaN(hNum) ? String(h) : fmtHeight(hNum);
    }

    const w = b.weight as number | string | undefined;
    if (w != null) {
      const wNum = typeof w === 'number' ? w : parseFloat(String(w));
      result.weight = isNaN(wNum) ? String(w) : `${Math.round(wNum)} lbs`;
    }

    if (b.college) result.college = String(b.college);

    const tp = (b.turnedPro ?? b.turnedProfessional) as number | string | undefined;
    if (tp != null) { const n = parseInt(String(tp)); if (!isNaN(n) && n > 1900) result.turnedPro = n; }

    const debut = (b.pgaTourDebutYear ?? b.debutYear) as number | string | undefined;
    if (debut != null) { const n = parseInt(String(debut)); if (!isNaN(n) && n > 1900) result.pgaTourDebut = n; }

    const earnings = (b.careerEarnings ?? b.careerMoney) as unknown;
    if (earnings != null) result.careerEarnings = parseEarningsStr(earnings);

    const wins = (b.pgaTourWins ?? b.careerWins ?? b.wins) as number | string | undefined;
    if (wins != null) { const n = parseInt(String(wins)); if (!isNaN(n) && n >= 0) result.careerWins = n; }

    const starts = (b.pgaTourStarts ?? b.careerStarts ?? b.events) as number | string | undefined;
    if (starts != null) { const n = parseInt(String(starts)); if (!isNaN(n) && n >= 0) result.careerStarts = n; }

    const mw = b.majorWins as number | string | undefined;
    if (mw != null) { const n = parseInt(String(mw)); if (!isNaN(n) && n >= 0) result.majorWins = n; }

    const ms = b.majorStarts as number | string | undefined;
    if (ms != null) { const n = parseInt(String(ms)); if (!isNaN(n) && n >= 0) result.majorStarts = n; }
  } catch { /* ignore */ }
  return result;
}

async function fetchEspnBio(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const profileRes = await fetch(`${ESPN_ATHLETES}/${espnId}`, { signal: AbortSignal.timeout(5000) });
    if (profileRes.ok) {
      const data = await profileRes.json() as { athlete?: Record<string, unknown> };
      const a = data?.athlete;
      if (a) {
        if (a.height != null) {
          const hNum = parseFloat(String(a.height));
          result.height = isNaN(hNum) ? null : fmtHeight(hNum);
        }
        if (a.weight != null) result.weight = `${a.weight} lbs`;
        const dobRaw = (a.dateOfBirth ?? a.birthDate) as string | undefined;
        if (dobRaw) { result.dob = fmtDob(dobRaw); result.age = calcAge(dobRaw); }
        if (a.college) result.college = String(a.college);
        if (a.proYear != null) { const n = parseInt(String(a.proYear)); if (!isNaN(n) && n > 1900) result.turnedPro = n; }
      }
    }
  } catch { /* ignore */ }

  try {
    const ovRes = await fetch(`${ESPN_ATHLETES}/${espnId}/overview`, { signal: AbortSignal.timeout(5000) });
    if (ovRes.ok) {
      const data = await ovRes.json() as Record<string, unknown>;
      // ESPN may put statistics under data.athlete.statistics or data.statistics
      const athleteNode = data?.athlete as Record<string, unknown> | undefined;
      const statistics = (athleteNode?.statistics ?? data?.statistics) as Record<string, unknown> | undefined;
      if (statistics) {
        const names: string[] = (statistics.names as string[]) ?? [];
        const splits = (statistics.splits as Array<Record<string, unknown>>) ?? [];
        const careerSplit = splits.find((s) =>
          String(s.displayName ?? '').toLowerCase().includes('career') ||
          String(s.type ?? '').toLowerCase() === 'career'
        );
        if (careerSplit) {
          const stats = (careerSplit.stats as unknown[]) ?? [];
          names.forEach((statName, i) => {
            const val = stats[i];
            if (val == null) return;
            const n = statName.toLowerCase();
            if (n.includes('win') && result.careerWins == null) {
              const num = parseInt(String(val)); if (!isNaN(num) && num >= 0) result.careerWins = num;
            }
            if ((n.includes('start') || n.includes('event')) && result.careerStarts == null) {
              const num = parseInt(String(val)); if (!isNaN(num) && num >= 0) result.careerStarts = num;
            }
            if (n.includes('earn') || n.includes('money')) {
              result.careerEarnings = parseEarningsStr(val);
            }
          });
        }
      }
    }
  } catch { /* ignore */ }

  return result;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  const pgaTourId = url.searchParams.get('pgaTourId') ?? '';
  if (!name) return Response.json({ bio: null });

  const cacheKey = `player-bio:v3:${name}`;
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

  // Try PGA Tour GQL (nested then flat)
  if (pgaTourId) {
    const [nested, flat] = await Promise.all([fetchPgaBio(pgaTourId), fetchPgaBioFlat(pgaTourId)]);
    merge(nested);
    merge(flat);
  }

  // ESPN fallback for any still-null fields
  try {
    const espnId = await getEspnId(name);
    if (espnId) merge(await fetchEspnBio(espnId));
  } catch { /* ignore */ }

  try { await redis.setex(cacheKey, 86400, JSON.stringify(bio)); } catch { /* ignore */ }
  return Response.json({ bio });
}
