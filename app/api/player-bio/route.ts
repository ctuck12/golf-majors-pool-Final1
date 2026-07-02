export const dynamic = 'force-dynamic';
import redis from '@/app/lib/redis';
import { getEspnId } from '@/app/lib/espn-player-season';
import { PLAYER_BIO_OVERRIDES, type BioOverride } from '@/app/lib/player-bio-overrides';
import { PLAYER_POOL_WITH_PGA_IDS, PLAYER_ARCHIVE } from '@/app/lib/player-pool';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const ESPN_ATHLETES = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

export type PlayerBio = {
  height: string | null;
  weight: string | null;
  dob: string | null;
  age: number | null;
  birthPlace: string | null;
  college: string | null;
  collegeConfirmedAbsent: boolean;
  swing: string | null;
  turnedPro: number | null;
  pgaTourDebut: number | null;
  careerStarts: number | null;
  cutsMade: number | null;
  careerWins: number | null;
  majorStarts: number | null;
  majorCutsMade: number | null;
  majorWins: number | null;
  careerEarnings: string | null;
  // Per-win detail powering the click-through popups on the Wins rows.
  pgaTourWinsList: WinEntry[] | null;
  majorWinsList: WinEntry[] | null;
};

export type WinEntry = { tournament: string; year: string; course: string | null; toPar: string | null };

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

// Normalize a finishing score relative to par for display: 0 -> "E", negatives "-18",
// positives "+2". Accepts numbers or strings like "-18", "E", "Even". Returns null if blank.
function fmtToPar(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^(e|even)$/i.test(s)) return 'E';
  const n = parseInt(s.replace(/[^\d.+-]/g, ''), 10);
  if (isNaN(n)) return null;
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

function parseEarnings(val: unknown): string | null {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return !isNaN(n) && n > 0 ? fmtEarnings(n) : null;
}

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, D.C.',
};

// ESPN returns birthPlace as { city, state, country }. Show "City, State" for US players (expanding
// the 2-letter state to its full name, e.g. GA -> Georgia), otherwise "City, Country".
function parseBirthPlace(val: unknown): string | null {
  if (!val || typeof val !== 'object') return null;
  const o = val as Record<string, unknown>;
  const city = o.city ? String(o.city).trim() : '';
  let state = o.state ? String(o.state).trim() : '';
  const country = o.country ? String(o.country).trim() : '';
  const isUs = !country || /^(usa?|united states)$/i.test(country);
  if (state && US_STATES[state.toUpperCase()]) state = US_STATES[state.toUpperCase()];
  const region = state || (isUs ? '' : country);
  if (city && region) return `${city}, ${region}`;
  return city || region || null;
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

// PGA Tour REST stats API — fallback for DOB, height, weight when GQL/ESPN come up empty
async function fetchPgaTourRestBio(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    // Cache the full player list in Redis for 6 hours to avoid repeated large fetches
    let raw: string | null = null;
    try { raw = await redis.get('pga-rest-players:v1'); } catch { /* ignore */ }
    if (!raw) {
      const res = await fetch('https://statdata.pgatour.com/players/player.json', {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: { 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      });
      if (!res.ok) return result;
      raw = await res.text();
      try { await redis.setex('pga-rest-players:v1', 21600, raw); } catch { /* ignore */ }
    }
    const data = JSON.parse(raw) as { plrs?: Record<string, unknown>[] };
    const players = data.plrs ?? [];
    const player = players.find(p => String(p.pid ?? p.id ?? p.playerId ?? '') === pgaTourId);
    if (!player) return result;

    // DOB — field may be "dob", "birthDate", or "born"
    const dob = (player.dob ?? player.birthDate ?? player.born) as string | undefined;
    if (dob) { result.dob = fmtDob(dob); result.age = calcAge(dob); }

    // Height — stored as total inches (e.g. 72) or string like "6-0"
    const ht = player.ht ?? player.height;
    if (ht != null) {
      const htStr = String(ht);
      if (htStr.includes('-')) {
        const [ft, ins] = htStr.split('-').map(Number);
        if (!isNaN(ft) && !isNaN(ins)) result.height = fmtHeight(ft * 12 + ins);
      } else {
        const htNum = parseFloat(htStr);
        if (!isNaN(htNum) && htNum > 48 && htNum < 96) result.height = fmtHeight(htNum);
      }
    }

    // Weight — stored as pounds number or string
    const wt = player.wt ?? player.weight;
    if (wt != null) {
      const wtNum = parseFloat(String(wt).replace(/[^\d.]/g, ''));
      if (!isNaN(wtNum) && wtNum > 100 && wtNum < 400) result.weight = `${Math.round(wtNum)} lbs`;
    }

    // College
    const college = player.college ?? player.school ?? player.alma;
    if (college) result.college = parseCollege(college);

    // Turned pro
    const tp = player.turnedPro ?? player.proYear ?? player.turned;
    if (tp != null) result.turnedPro = parseYear(tp);

    // Handedness
    const hand = player.hand ?? player.hands ?? player.swing;
    if (hand != null) {
      const h = String(hand).toLowerCase();
      if (h === 'r' || h === '1' || h.includes('right')) result.swing = 'Right';
      else if (h === 'l' || h === '2' || h.includes('left')) result.swing = 'Left';
    }
  } catch { /* ignore */ }
  return result;
}

// PGA Tour GQL: the real bio lives at player(id){ playerBio { ... } } (type PlayerBio).
// Field names confirmed via schema introspection (/api/admin/pga-schema-probe):
// heightImperial, weightImperial, born (DOB), age, turnedPro, school (college), careerEarnings.
// This is the fallback that fills height/weight/DOB/college for players ESPN lacks.
async function fetchPgaProfileBio(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  const query = `query Player($id: ID!) {
    player(id: $id) {
      playerBio {
        heightImperial weightImperial born age turnedPro school careerEarnings
      }
    }
  }`;
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables: { id: pgaTourId } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return result;
    const json = await res.json() as {
      data?: { player?: { playerBio?: Record<string, unknown> } };
      errors?: unknown[];
    };
    if (json.errors?.length) return result;
    const b = json.data?.player?.playerBio;
    if (!b) return result;

    // height: PGA returns e.g. "6' 3\"" — keep the imperial string (normalize spacing), else parse inches.
    if (typeof b.heightImperial === 'string' && b.heightImperial.trim()) {
      const hs = b.heightImperial.trim();
      if (/['"]/.test(hs)) {
        result.height = hs.replace(/\s+/g, '');
      } else {
        const hNum = parseFloat(hs);
        if (!isNaN(hNum) && hNum > 48 && hNum < 96) result.height = fmtHeight(hNum);
      }
    }
    // weight: e.g. "200" or "200 lbs"
    if (b.weightImperial != null) {
      const wNum = parseFloat(String(b.weightImperial).replace(/[^\d.]/g, ''));
      if (!isNaN(wNum) && wNum > 100 && wNum < 400) result.weight = `${Math.round(wNum)} lbs`;
    }
    // dob: `born` is a date string
    if (b.born) {
      const formatted = fmtDob(String(b.born));
      if (formatted) { result.dob = formatted; result.age = calcAge(String(b.born)); }
    }
    if (result.age == null && b.age != null) {
      const ageNum = parseInt(String(b.age));
      if (!isNaN(ageNum) && ageNum > 0 && ageNum < 120) result.age = ageNum;
    }
    // college: `school`
    const school = parseCollege(b.school);
    if (school) result.college = school;
    const tp = parseYear(b.turnedPro);
    if (tp != null) result.turnedPro = tp;
    const earnings = parseEarnings(b.careerEarnings);
    if (earnings) result.careerEarnings = earnings;
  } catch { /* ignore */ }
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

    // ESPN's site athlete endpoint exposes the birthdate as `displayDOB` (e.g. "9/16/1990"),
    // NOT dateOfBirth — include it so DOB populates from this (fast, reliable) endpoint instead
    // of depending solely on the flakier core endpoint.
    const dob = (a.dateOfBirth ?? a.birthDate ?? a.dob ?? a.displayDOB) as string | undefined;
    if (dob) {
      const formatted = fmtDob(String(dob));
      if (formatted) { result.dob = formatted; result.age = calcAge(String(dob)); }
    }
    // Fallback: site endpoint also returns a precomputed `age` integer.
    if (result.age == null && a.age != null) {
      const ageNum = parseInt(String(a.age));
      if (!isNaN(ageNum) && ageNum > 0 && ageNum < 120) result.age = ageNum;
    }

    if (!result.birthPlace) result.birthPlace = parseBirthPlace(a.birthPlace);

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

    if (!result.birthPlace) result.birthPlace = parseBirthPlace(a.birthPlace);

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
            tournamentName
            courseName
            toPar
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
          tournaments?: Array<{ year?: unknown; position?: unknown; tournamentName?: unknown; courseName?: unknown; toPar?: unknown }>;
        };
      };
      errors?: unknown[];
    };
    // Only bail when the query itself failed (errors, or no data object). A SUCCESSFUL query
    // with an empty tournaments list means the player has genuinely never started a major —
    // that's a real 0, not unknown, so it should render "0" rather than a dash.
    if (json.errors?.length || !json.data) return result;
    const tournaments = json.data.playerProfileMajorResults?.tournaments ?? [];

    const isWin = (pos: unknown) => {
      const p = String(pos ?? '').trim();
      return p === '1' || p === 'W' || p === 'P1';
    };
    // Each entry = one major appearance; position "1" = win
    result.majorStarts = tournaments.length;
    // A made cut = a real weekend finishing position (numeric or T-numeric, e.g. "1", "T10", "22").
    // A missed cut shows as "CUT" (and WD/DQ are likewise not a made cut).
    result.majorCutsMade = tournaments.filter(t => /^T?\d+$/.test(String(t.position ?? '').trim())).length;
    const majorWins = tournaments.filter(t => isWin(t.position));
    result.majorWins = majorWins.length;
    result.majorWinsList = majorWins
      .map(t => ({
        tournament: String(t.tournamentName ?? '').trim(),
        year: String(t.year ?? '').trim(),
        course: String(t.courseName ?? '').trim() || null,
        toPar: fmtToPar(t.toPar),
      }))
      .sort((a, b) => Number(b.year) - Number(a.year)); // newest first
  } catch { /* ignore */ }
  return result;
}

// PGA Tour GQL: career starts/earnings, summed from playerProfileTournamentResults
// (tourCode R = PGA Tour). Each group carries an overviewInfo summary; summing across
// groups yields official PGA Tour career totals. Works for any player with a PGA Tour ID,
// including DP-World-primary players ESPN's PGA career endpoints don't cover.
// NOTE: overviewInfo.wins is NOT summed here — it over-counts (it credits team events like
// the Ryder/Presidents Cup as wins). The accurate win count comes from fetchPgaTourWins,
// which inspects each tournament's finishing position directly.
async function fetchPgaCareerResults(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};
  try {
    const query = `query R($id: ID!) {
      playerProfileTournamentResults(playerId: $id, tourCode: R) {
        tournaments { overviewInfo { events cutsMade money } }
      }
    }`;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables: { id: pgaTourId } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return result;
    const json = await res.json() as {
      data?: { playerProfileTournamentResults?: { tournaments?: Array<{ overviewInfo?: { events?: number; cutsMade?: number; money?: number } }> } };
      errors?: unknown[];
    };
    if (json.errors?.length) return result;
    const groups = json.data?.playerProfileTournamentResults?.tournaments ?? [];
    if (groups.length === 0) return result;
    let events = 0, cutsMade = 0, money = 0;
    for (const g of groups) {
      const o = g.overviewInfo;
      if (!o) continue;
      events += o.events ?? 0;
      cutsMade += o.cutsMade ?? 0;
      money += o.money ?? 0;
    }
    if (events > 0) {
      result.careerStarts = events;
      result.cutsMade = cutsMade; // 0 is valid
    }
    if (money > 0) result.careerEarnings = fmtEarnings(money);
  } catch { /* ignore */ }
  return result;
}

// Team/exhibition/"silly season" events the PGA Tour lists in a player's results but that do NOT
// count as official PGA Tour victories (no official-win credit). Excluded from the win count +
// list. NOTE: legitimate official team events (e.g. the Zurich Classic of New Orleans) are NOT
// matched here, so they still count.
const NON_OFFICIAL_WIN_EVENTS = /ryder cup|presidents cup|skins|team matches|diners club|kapalua international|\brmcc\b|jcpenney|sazale|shootout|world challenge|grand slam|world cup|wendy'?s|three-?tour|3-?tour/i;

// PGA Tour GQL: accurate career win count + the per-win detail (tournament + year) shown in
// the click-through popup. Reads each tournament row's finishing position rather than the
// aggregate overviewInfo.wins (which over-counts team events). A finish of "1" (outright) or
// "P1" (playoff win) is a victory; Ryder/Presidents Cup team events are excluded.
type RawWinRow = { position?: unknown; year?: unknown; tournamentName?: unknown; courseName?: unknown; toPar?: unknown };
type RawWinGroup = { tournamentOverview?: { tournamentName?: unknown }; tournaments?: RawWinRow[] };

async function fetchPgaTourWins(pgaTourId: string): Promise<Partial<PlayerBio>> {
  const result: Partial<PlayerBio> = {};

  // The per-row tournament type isn't introspected here, so we try an ENRICHED query
  // (with courseName + toPar for the win popup) and fall back to the known-good MINIMAL
  // query if those fields aren't valid — that way the win count never breaks.
  const runQuery = async (innerFields: string): Promise<{ groups: RawWinGroup[]; errored: boolean }> => {
    const query = `query R($id: ID!) {
      playerProfileTournamentResults(playerId: $id, tourCode: R) {
        tournaments {
          tournamentOverview { tournamentName }
          tournaments { ${innerFields} }
        }
      }
    }`;
    try {
      const res = await fetch(PGA_GQL, {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({ query, variables: { id: pgaTourId } }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return { groups: [], errored: true };
      const json = await res.json() as {
        data?: { playerProfileTournamentResults?: { tournaments?: RawWinGroup[] } };
        errors?: unknown[];
      };
      if (json.errors?.length || !json.data) return { groups: [], errored: true };
      return { groups: json.data.playerProfileTournamentResults?.tournaments ?? [], errored: false };
    } catch {
      return { groups: [], errored: true };
    }
  };

  let { groups, errored } = await runQuery('position year tournamentName courseName toPar');
  if (errored) ({ groups, errored } = await runQuery('position year tournamentName'));
  // Query failed entirely — leave wins null so other sources can fill the count.
  if (errored) return result;
  // No per-row groups means we can't reliably count — leave wins null.
  if (groups.length === 0) return result;

  const wins: WinEntry[] = [];
  for (const g of groups) {
    const groupName = String(g.tournamentOverview?.tournamentName ?? '').trim();
    for (const row of g.tournaments ?? []) {
      const pos = String(row.position ?? '').trim();
      if (pos !== '1' && pos !== 'P1') continue;
      const tournament = (String(row.tournamentName ?? '').trim() || groupName);
      if (NON_OFFICIAL_WIN_EVENTS.test(tournament)) continue;
      wins.push({
        tournament,
        year: String(row.year ?? '').trim(),
        course: String(row.courseName ?? '').trim() || null,
        toPar: fmtToPar(row.toPar),
      });
    }
  }
  wins.sort((a, b) => Number(b.year) - Number(a.year)); // newest first
  result.pgaTourWinsList = wins;
  result.careerWins = wins.length; // authoritative — 0 is valid (no PGA Tour wins yet)
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

// Name normalization shared by override + pgaTourId resolution, so name variants still
// match (e.g. a leaderboard's "Jayden Schaper" vs the pool's "Jayden Trey Schaper").
const normBioName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();
const firstLastKey = (s: string) => {
  const p = normBioName(s).split(/\s+/).filter(Boolean);
  return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : normBioName(s);
};

// Index the override map by normalized full name and by first+last for tolerant lookup.
const OVERRIDE_BY_NORM: Record<string, BioOverride> = {};
const OVERRIDE_BY_FL: Record<string, BioOverride> = {};
for (const [nm, ov] of Object.entries(PLAYER_BIO_OVERRIDES)) {
  OVERRIDE_BY_NORM[normBioName(nm)] = ov;
  const fl = firstLastKey(nm);
  if (!(fl in OVERRIDE_BY_FL)) OVERRIDE_BY_FL[fl] = ov;
}
function lookupBioOverride(name: string): BioOverride | undefined {
  return PLAYER_BIO_OVERRIDES[name] ?? OVERRIDE_BY_NORM[normBioName(name)] ?? OVERRIDE_BY_FL[firstLastKey(name)];
}

// Index the pool's pgaTourId by name, so a bio request arriving with a missing/0 pgaTourId
// (e.g. opened from a live leaderboard) still gets PGA career/major data.
const POOL_PGA_BY_NORM: Record<string, number> = {};
const POOL_PGA_BY_FL: Record<string, number> = {};
for (const p of [...PLAYER_POOL_WITH_PGA_IDS, ...PLAYER_ARCHIVE]) {
  if (!p.pgaTourId) continue;
  const n = normBioName(p.name);
  if (!(n in POOL_PGA_BY_NORM)) POOL_PGA_BY_NORM[n] = p.pgaTourId; // active pool wins on collision
  const fl = firstLastKey(p.name);
  if (!(fl in POOL_PGA_BY_FL)) POOL_PGA_BY_FL[fl] = p.pgaTourId;
}
// Non-pool Masters-legend field players whose PGA Tour ids carry LEADING ZEROS (older players),
// so they can't be number literals in the pool. Keyed by normalized name. These give the bio
// their real PGA Tour cuts + major starts/cuts/wins and FedEx rank.
const LEGEND_PGA_IDS: Record<string, string> = {
  'vijay singh': '06567',
  'jose maria olazabal': '06373',
  'fred couples': '01226',
  'angel cabrera': '20848',
};
// Non-pool field players (DP World / international) who ARE on the PGA Tour but aren't in the
// draft pool, so resolvePgaTourId can't find their id by name. Keyed by normalized name; supplies
// their PGA Tour id so the bio pulls PGA Tour career + major starts/cuts/wins and a real headshot.
const NON_POOL_PGA_IDS: Record<string, string> = {
  'mikael lindberg': '48293',
  'daniel brown': '57259',
};
function resolvePgaTourId(name: string, provided: string): string {
  // LEGEND_PGA_IDS wins even over a provided id: these ids have LEADING ZEROS that a numeric
  // pool entry would drop (e.g. adding Couples to the draft pool as pgaTourId 1226 instead of
  // 01226), so the correct string id must always take priority for these players.
  const legend = LEGEND_PGA_IDS[normBioName(name)] ?? LEGEND_PGA_IDS[firstLastKey(name)];
  if (legend) return legend;
  if (provided && provided !== '0') return provided;
  const hit = POOL_PGA_BY_NORM[normBioName(name)] ?? POOL_PGA_BY_FL[firstLastKey(name)];
  if (hit) return String(hit);
  return NON_POOL_PGA_IDS[normBioName(name)] ?? NON_POOL_PGA_IDS[firstLastKey(name)] ?? provided;
}

// PGA Tour cloudinary headshot for a given PGA Tour id — used as a photo fallback for players
// ESPN has no headshot for (their ESPN silhouette 404s). `d_headshots_default.png` yields a
// neutral default if the player has no PGA headshot either.
function pgaHeadshotUrl(pgaTourId: string): string | null {
  if (!pgaTourId || pgaTourId === '0') return null;
  return `https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_350,q_auto,w_280/headshots_${pgaTourId}.png`;
}

// Overlay manual overrides (app/lib/player-bio-overrides.ts) onto a bio. Override values
// win over API data. Applied on every response (including cache hits) so edits take effect
// immediately without a cache bump.
function applyBioOverrides(name: string, bio: PlayerBio): PlayerBio {
  const ov = lookupBioOverride(name);
  if (!ov) return bio;
  if (ov.height) bio.height = ov.height;
  if (ov.weight) bio.weight = ov.weight;
  if (ov.birthPlace) bio.birthPlace = ov.birthPlace;
  if (ov.swing) bio.swing = ov.swing;
  if (ov.college) { bio.college = ov.college; bio.collegeConfirmedAbsent = false; }
  else if (ov.noCollege) { bio.college = null; bio.collegeConfirmedAbsent = true; }
  if (ov.dob) {
    const formatted = fmtDob(ov.dob);
    if (formatted) { bio.dob = formatted; bio.age = calcAge(ov.dob); }
  }
  if (ov.turnedPro != null) bio.turnedPro = ov.turnedPro;
  return bio;
}

// A stable signature of the *displayed* bio values. Age is excluded (it's derived from DOB and
// would tick over on a birthday without any real data change).
function stableBioSig(bio: PlayerBio): string {
  return JSON.stringify({
    h: bio.height, w: bio.weight, dob: bio.dob, bp: bio.birthPlace,
    col: bio.college, colAbs: bio.collegeConfirmedAbsent, sw: bio.swing, tp: bio.turnedPro,
    cs: bio.careerStarts, cm: bio.cutsMade, cw: bio.careerWins,
    ms: bio.majorStarts, mcm: bio.majorCutsMade, mw: bio.majorWins, ce: bio.careerEarnings,
  });
}

// Returns when the bio last CHANGED (not when it was last fetched): compares the current values
// to a persisted signature and only advances the timestamp when something actually differs. The
// signature/timestamp live far longer than the 24h bio cache so the "changed" time survives normal
// refetch cycles.
const BIO_SIG_TTL = 60 * 24 * 60 * 60; // 60 days
async function resolveBioChangedAt(name: string, bio: PlayerBio): Promise<string> {
  const key = `player-bio-sig:v1:${name}`;
  const sig = stableBioSig(bio);
  try {
    const raw = await redis.get(key);
    if (raw) {
      const prev = JSON.parse(raw as string) as { sig?: string; changedAt?: string };
      if (prev.sig === sig && prev.changedAt) return prev.changedAt;
    }
  } catch { /* ignore */ }
  const changedAt = new Date().toISOString();
  try { await redis.setex(key, BIO_SIG_TTL, JSON.stringify({ sig, changedAt })); } catch { /* ignore */ }
  return changedAt;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  // Backfill a missing/0 pgaTourId from the pool by name so PGA career/major data still loads.
  const pgaTourId = resolvePgaTourId(name, url.searchParams.get('pgaTourId') ?? '');
  if (!name) return Response.json({ bio: null });

  const cacheKey = `player-bio:v32:${name}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const espnId = await getEspnId(name).catch(() => null);
      const espnPhotoUrl = espnId ? `https://a.espncdn.com/i/headshots/golf/players/full/${espnId}.png` : null;
      const pgaPhotoUrl = pgaHeadshotUrl(pgaTourId);
      const finalBio = applyBioOverrides(name, JSON.parse(cached as string));
      const updatedAt = await resolveBioChangedAt(name, finalBio);
      return Response.json({ bio: finalBio, espnPhotoUrl, pgaPhotoUrl, updatedAt });
    }
  } catch { /* ignore */ }

  const bio: PlayerBio = {
    height: null, weight: null, dob: null, age: null, birthPlace: null,
    college: null, collegeConfirmedAbsent: false, swing: null,
    turnedPro: null, pgaTourDebut: null,
    careerStarts: null, cutsMade: null, careerWins: null, majorStarts: null,
    majorCutsMade: null, majorWins: null, careerEarnings: null,
    pgaTourWinsList: null, majorWinsList: null,
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
    fetches.push(fetchPgaCareerResults(pgaTourId)); // first: authoritative PGA Tour career totals
    fetches.push(fetchPgaTourWins(pgaTourId));      // accurate win count + per-win list
    fetches.push(fetchPgaProfileBio(pgaTourId));
    fetches.push(fetchPgaMajorResults(pgaTourId));
    fetches.push(fetchPgaTourRestBio(pgaTourId));
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

  // Set after all merges: if we got profile data (DOB) but still no college, it's confirmed absent.
  // Can't do this inside merge() because collegeConfirmedAbsent starts as false (not null).
  if (!bio.college && bio.dob) bio.collegeConfirmedAbsent = true;

  // If we know the player has career starts but earnings came back blank, that's a real $0
  // (they've played but not earned), not unknown — show "$0" instead of a dash.
  if (bio.careerStarts != null && bio.careerEarnings == null) bio.careerEarnings = fmtEarnings(0);

  try { await redis.setex(cacheKey, 86400, JSON.stringify(bio)); } catch { /* ignore */ }
  const espnPhotoUrl = espnId
    ? `https://a.espncdn.com/i/headshots/golf/players/full/${espnId}.png`
    : null;
  const pgaPhotoUrl = pgaHeadshotUrl(pgaTourId);
  const finalBio = applyBioOverrides(name, bio);
  const updatedAt = await resolveBioChangedAt(name, finalBio);
  return Response.json({ bio: finalBio, espnPhotoUrl, pgaPhotoUrl, updatedAt });
}
