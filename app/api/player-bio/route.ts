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

async function fetchPgaBio(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const res = await fetch(PGA_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PGA_KEY,
      'x-amz-user-agent': 'aws-amplify/3.8.21 react-native',
    },
    body: JSON.stringify({
      query: `query PlayerBio($playerId: ID!) {
        playerBio(playerId: $playerId) {
          birthDate
          height
          weight
          college
          turnedPro
          careerEarnings
          pgaTourWins
          majorWins
          pgaTourStarts
          majorStarts
          pgaTourDebutYear
        }
      }`,
      variables: { playerId: pgaTourId },
    }),
    signal: AbortSignal.timeout(4000),
  });
  const json = await res.json();
  const b = json?.data?.playerBio;
  if (!b) return {};

  const result: Partial<PlayerBio> = {};

  const dobRaw = b.birthDate ?? b.dateOfBirth;
  if (dobRaw) {
    result.dob = fmtDob(String(dobRaw));
    result.age = calcAge(String(dobRaw));
  }

  const heightRaw = b.height;
  if (heightRaw != null) {
    if (typeof heightRaw === 'number') result.height = fmtHeight(heightRaw);
    else if (typeof heightRaw === 'string' && /\d/.test(heightRaw)) result.height = heightRaw;
  }

  const weightRaw = b.weight;
  if (weightRaw != null) {
    if (typeof weightRaw === 'number') result.weight = `${weightRaw} lbs`;
    else if (typeof weightRaw === 'string') result.weight = weightRaw;
  }

  if (b.college) result.college = b.college;

  const turnedProRaw = b.turnedPro ?? b.turnedProfessional ?? b.turned_professional;
  if (turnedProRaw != null) result.turnedPro = Number(turnedProRaw);

  const earningsRaw = b.careerEarnings ?? b.careerMoney;
  if (earningsRaw != null) {
    const parsed = parseFloat(String(earningsRaw).replace(/[$,]/g, ''));
    if (!isNaN(parsed)) result.careerEarnings = fmtEarnings(parsed);
  }

  const winsRaw = b.pgaTourWins ?? b.careerWins ?? b.wins;
  if (winsRaw != null) result.careerWins = Number(winsRaw);

  const startsRaw = b.pgaTourStarts ?? b.careerStarts ?? b.events;
  if (startsRaw != null) result.careerStarts = Number(startsRaw);

  if (b.majorWins != null) result.majorWins = Number(b.majorWins);
  if (b.majorStarts != null) result.majorStarts = Number(b.majorStarts);

  const debutRaw = b.pgaTourDebutYear ?? b.debutYear;
  if (debutRaw != null) result.pgaTourDebut = Number(debutRaw);

  return result;
}

async function fetchEspnBio(espnId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const profileRes = await fetch(`${ESPN_ATHLETES}/${espnId}`, { signal: AbortSignal.timeout(4000) });
    const profile = await profileRes.json();
    const a = profile?.athlete;
    if (a) {
      if (a.height != null) result.height = fmtHeight(Number(a.height));
      if (a.weight != null) result.weight = `${a.weight} lbs`;
      if (a.dateOfBirth) {
        result.dob = fmtDob(String(a.dateOfBirth));
        result.age = calcAge(String(a.dateOfBirth));
      }
      if (a.college) result.college = a.college;
      if (a.proYear != null) result.turnedPro = Number(a.proYear);
    }
  } catch { /* ignore */ }

  try {
    const ovRes = await fetch(`${ESPN_ATHLETES}/${espnId}/overview`, { signal: AbortSignal.timeout(4000) });
    const ov = await ovRes.json();
    const splits = ov?.athlete?.statistics?.splits;
    const names: string[] = ov?.athlete?.statistics?.names ?? [];
    if (Array.isArray(splits)) {
      const careerSplit = splits.find((s: Record<string, unknown>) =>
        String((s as Record<string, unknown>).displayName ?? '').toLowerCase().includes('career') ||
        String((s as Record<string, unknown>).type ?? '').toLowerCase().includes('career')
      );
      if (careerSplit && Array.isArray((careerSplit as Record<string, unknown>).stats)) {
        const stats: unknown[] = (careerSplit as Record<string, unknown>).stats as unknown[];
        names.forEach((name: string, i: number) => {
          const val = stats[i];
          if (val == null) return;
          const n = name.toLowerCase();
          if (n.includes('win') && result.careerWins == null) result.careerWins = Number(val);
          if (n.includes('start') || n.includes('event')) result.careerStarts = Number(val);
          if (n.includes('earn') || n.includes('money')) {
            const parsed = parseFloat(String(val).replace(/[$,]/g, ''));
            if (!isNaN(parsed)) result.careerEarnings = fmtEarnings(parsed);
          }
        });
      }
    }
  } catch { /* ignore */ }

  return result;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  const pgaTourId = url.searchParams.get('pgaTourId') ?? '';

  const cacheKey = `player-bio:v1:${name}`;
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

  // Try PGA Tour GQL
  if (pgaTourId) {
    try {
      const pgaData = await fetchPgaBio(pgaTourId);
      Object.assign(bio, pgaData);
    } catch { /* ignore */ }
  }

  // ESPN fallback for null fields
  try {
    const espnId = await getEspnId(name);
    if (espnId) {
      const espnData = await fetchEspnBio(String(espnId));
      for (const [k, v] of Object.entries(espnData)) {
        if ((bio as Record<string, unknown>)[k] == null && v != null) {
          (bio as Record<string, unknown>)[k] = v;
        }
      }
    }
  } catch { /* ignore */ }

  try {
    await redis.setex(cacheKey, 86400, JSON.stringify(bio));
  } catch { /* ignore */ }

  return Response.json({ bio });
}
