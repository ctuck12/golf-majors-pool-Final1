'use client';

import { Fragment, startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import {
  AlertCircle,
  ArrowLeft,
  CircleUserRound,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Lock,
  LogIn,
  Mail,
  MoreVertical,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  buildPlaceholderScoreBreakdown,
  SCORING_RULES,
  type GolferScoreBreakdown,
} from './lib/scoring';

const SALARY_CAP = 50000;
const REQUIRED_GOLFERS = 6;

// Total tournament par (course par × 4 rounds). Players and Masters never change.
// Update pga/us-open/open each season as courses rotate.
const TOURNAMENT_TOTAL_PAR: Partial<Record<string, number>> = {
  players: 288,   // TPC Sawgrass, par 72
  masters: 288,   // Augusta National, par 72
  pga: 280,       // Aronimink Golf Club, par 70 (2026)
  'us-open': 280, // Oakmont Country Club, par 70 (2026)
  open: 284,      // Royal Portrush, par 71 (2026)
};

// Exact salaries for the 2026 PGA Championship field (overrides the computed odds-based salary)
const PGA_SALARY_OVERRIDES: Record<number, number> = {
    1: 11900,   2: 10400,  16:  9200,  15:  9100,  23:  9100,
    3:  8800,   5:  8600,   6:  8500,  20:  8100,   4:  8000,
   18:  7900,  61:  7900,   7:  7700,  17:  7700,   9:  7700,
   21:  7600,  29:  7600,   8:  7500,  10:  7500,  50:  7500,
   22:  7400,  37:  7400,  90:  7400,  30:  7300,  19:  7300,
   25:  7300,  31:  7300,  14:  7300,  12:  7300,  53:  7200,
   54:  7200,  40:  7200,  35:  7200,  27:  7100,  45:  7100,
   49:  7100,  33:  7100,  94:  7000,  55:  7000,  60:  7000,
   38:  7000,  32:  7000, 116:  7000,  36:  7000, 114:  7000,
   98:  7000,  66:  6900,  24:  6800, 146:  6800, 112:  6800,
   80:  6800, 145:  6800,  57:  6700,  13:  6700, 121:  6700,
   48:  6700, 126:  6700, 158:  6700,  91:  6600, 102:  6600,
   28:  6600, 186:  6600,  72:  6600,  39:  6600,  75:  6600,
   78:  6600,  74:  6600,  42:  6600, 193:  6600,  52:  6500,
   34:  6500,  43:  6500,  93:  6500,  47:  6500, 119:  6500,
   44:  6500,  68:  6400, 153:  6400, 157:  6400,  59:  6400,
   58:  6400,  67:  6400, 148:  6400,  96:  6400, 139:  6400,
   76:  6400,  81:  6400, 131:  6300,  51:  6300, 166:  6300,
   63:  6300, 194:  6300, 151:  6300, 152:  6300, 136:  6300,
  170:  6300, 149:  6300,  56:  6300, 159:  6200, 117:  6200,
   64:  6200,  69:  6200,  70:  6200, 154:  6200,  79:  6200,
   62:  6200, 150:  6200, 161:  6200, 171:  6200,  41:  6200,
  168:  6200, 155:  6200,  65:  6100, 104:  6100, 169:  6100,
   77:  6100, 163:  6100, 167:  6100, 164:  6100, 143:  6100,
   71:  6100,  73:  6000,  46:  6000,  92:  6000, 165:  5900,
   87:  5900,  85:  5900, 172:  5900, 185:  5900, 103:  5900,
  173:  5900, 144:  5900,  89:  5900,  84:  5900, 174:  5900,
  178:  5900, 181:  5900, 175:  5900,  82:  5900, 184:  5900,
  190:  5900, 192:  5900, 188:  5900, 191:  5900, 183:  5800,
};
const STORAGE_PREFIX = 'golf-pool-live';
const SALARY_MIN = 5000;
const SALARY_MAX = 10800;
const DEFAULT_JOIN_CODE = 'MAJORS2026';
const COMMISSIONER_EMAIL = 'ctuck12@gmail.com';
const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';

const TOURNAMENTS = [
  {
    id: 'players',
    name: 'The Players',
    venue: 'TPC Sawgrass',
    lockAt: '2026-03-12T07:40:00',
  },
  {
    id: 'masters',
    name: 'The Masters',
    venue: 'Augusta National',
    lockAt: '2026-04-09T07:30:00',
  },
  {
    id: 'pga',
    name: 'The PGA',
    venue: 'Aronimink',
    lockAt: '2026-05-14T07:20:00',
  },
  {
    id: 'us-open',
    name: 'U.S. Open',
    venue: 'Shinnecock Hills',
    lockAt: '2026-06-18T07:15:00',
  },
  {
    id: 'open',
    name: 'The Open',
    venue: 'Royal Birkdale',
    lockAt: '2026-07-16T06:35:00',
  },
] as const;

const TOURNAMENT_LEADERBOARD_HEADER: Record<string, string> = {
  players: 'The Players Leaderboard',
  masters: 'The Masters Leaderboard',
  pga: 'The PGA Leaderboard',
  'us-open': 'U.S. Open Leaderboard',
  open: 'The Open Leaderboard',
};

const TOURNAMENT_PICKS_HEADER: Record<string, string> = {
  players: 'The Players Picks',
  masters: 'The Masters Picks',
  pga: 'PGA Championship Picks',
  'us-open': 'U.S. Open Picks',
  open: 'The Open Picks',
};

const TOURNAMENT_ENTRIES_INTRO: Record<string, string> = {
  players: 'Make or edit your picks for The Players Championship below.',
  masters: 'Make or edit your picks for The Masters below.',
  pga: 'Make or edit picks for the PGA Championship below.',
  'us-open': 'Make or edit your picks for the U.S. Open Championship below.',
  open: 'Make or edit picks for The Open Championship below.',
};

const TOURNAMENT_CARD_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/the-players-championship-logo.png',
  masters: '/the-masters-logo.png',
  pga: '/pga-aronimink-logo.png',
  'us-open': '/us-open-shinnecock-logo.gif',
  open: '/the-open-royal-birkdale-logo.png',
};

const TOURNAMENT_TAB_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/players-tab-logo.webp',
  masters: '/masters-tab-logo.png',
  pga: '/pga-tab-logo.png',
  'us-open': '/us-open-tab-logo.png',
  open: '/open-tab-logo.png',
};

const TOURNAMENT_HEADING_LOGOS: Partial<Record<TournamentId, string>> = {
  masters: '/masters-heading-logo.png',
};

const TOURNAMENT_PARS: Partial<Record<TournamentId, number>> = {
  players: 72,
  masters: 72,
  pga: 70,
  'us-open': 70,
  open: 70,
};

const PICK_HISTORY_NAMES: Record<string, string> = {
  players: 'The Players Championship',
  masters: 'The Masters Tournament',
  pga: 'PGA Championship',
  'us-open': 'U.S. Open Championship',
  open: 'The Open Championship',
};

// 12pm EDT on the Friday (Round 2) of each tournament
const TOURNAMENT_CUT_SHOW_AT: Partial<Record<TournamentId, string>> = {
  players: '2026-03-13T12:00:00-04:00',
  masters: '2026-04-10T12:00:00-04:00',
  pga: '2026-05-15T13:00:00-04:00',
  'us-open': '2026-06-19T12:00:00-04:00',
  open: '2026-07-17T12:00:00-04:00',
};

// Approximate first tee time (EDT) on the Saturday (Round 3) of each tournament
const TOURNAMENT_CUT_HIDE_AT: Partial<Record<TournamentId, string>> = {
  players: '2026-03-14T07:30:00-04:00',
  masters: '2026-04-11T08:00:00-04:00',
  pga: '2026-05-16T08:00:00-04:00',
  'us-open': '2026-06-20T07:45:00-04:00',
  open: '2026-07-18T01:35:00-04:00', // ~6:35 AM BST
};

const TOURNAMENT_TAB_LOGO_HEIGHTS: Partial<Record<TournamentId, number>> = {
  players: 46,
  pga: 46,
};

const TOURNAMENT_CARD_LOGO_SIZES: Partial<Record<TournamentId, { width: number; height: number }>> = {
  players: { width: 78, height: 78 },
  pga: { width: 76, height: 76 },
  'us-open': { width: 76, height: 76 },
  open: { width: 92, height: 92 },
};

const TOURNAMENT_CARD_WIDTH = 124;
const TOURNAMENT_CARD_HEIGHT = 45;

const pgaPhoto = (pgaId: number) =>
  `https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_350,q_auto,w_280/headshots_${pgaId}.png`;

const PLAYER_POOL = PLAYER_POOL_WITH_PGA_IDS;

const DEFAULT_ROSTERS: Record<string, number[]> = {
  players: [1, 2, 8, 10, 12, 14],
  masters: [1, 2, 3, 4, 5, 6],
  pga: [1, 3, 5, 8, 10, 11],
  'us-open': [1, 2, 5, 7, 10, 14],
  open: [2, 3, 5, 6, 8, 12],
};

type TournamentId = (typeof TOURNAMENTS)[number]['id'];
type MainTab = 'Standings' | 'My Entries' | 'Details' | 'Commissioner Hub';
const MAIN_TABS: MainTab[] = ['Standings', 'My Entries', 'Details', 'Commissioner Hub'];
const MAIN_TAB_STORAGE_KEY = `${STORAGE_PREFIX}:main-tab`;

type FeedRow = {
  position: string;
  score: string;
  thru: string;
  total?: string;
  currentRoundScore?: string | null;
  backNineStart?: boolean;
  teeTime?: string | null;
  canonicalName?: string;
  scoreBreakdown?: GolferScoreBreakdown;
  originalScore?: string;
};

type FullFieldPlayer = {
  playerId: string;
  poolPlayerId: number | null;
  name: string;
  position: string;
  score: string;
  thru: string;
  originalScore?: string;
  currentRoundScore?: string | null;
  teeTime?: string | null;
  backNineStart?: boolean;
};

type ScorecardHole = { hole: number; par: number; score: number | null; label: string };
type ScorecardRound = { round: number; score?: number | string; holes: ScorecardHole[] };
type ScorecardData = { courseName: string; par: number; rounds: ScorecardRound[]; source: string; message?: string };

type FeedResponse = {
  fetchedAt: string;
  players: FeedRow[];
  odds: Array<{
    canonicalName: string;
    odds: string;
  }>;
  oddsSource?: string;
  source: string;
  status: string;
  currentRound?: number;
  projectedCut?: string | null;
  fullLeaderboard?: FullFieldPlayer[];
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
};

type PoolInfo = {
  id: string;
  name: string;
  joinCode: string;
  lineupLocks: Partial<Record<TournamentId, boolean>>;
  payouts: Partial<Record<TournamentId, { first: number; second: number; third: number }>>;
};

type PoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
};

type CommissionerMember = AuthUser;
type AuthMode = 'login' | 'register';

type StandingGolfer = ReturnType<typeof buildPricedPlayers>[number] & {
  position: string;
  thru: string;
  score: string;
  total: string;
  currentRoundScore: string | null;
  backNineStart: boolean;
  teeTime: string | null;
  points: number;
  holesRemaining: number;
  scoreBreakdown: GolferScoreBreakdown;
  originalScore?: string;
};

type StandingEntry = PoolEntry & {
  picks: number[];
  golfers: StandingGolfer[];
  rosterPoints: number;
  holesRemaining: number;
  tieBreakValue: number;
  place: number;
};

const STATIC_ENTRIES: PoolEntry[] = [
  { id: 'static-2', name: 'Brady S.', rosters: { pga: [1, 3, 5, 7, 9, 11] }, tieBreaks: {} },
  { id: 'static-3', name: 'Megan T.', rosters: { pga: [2, 4, 6, 8, 12, 13] }, tieBreaks: {} },
  { id: 'static-4', name: 'Ryan H.', rosters: { pga: [3, 4, 5, 9, 10, 14] }, tieBreaks: {} },
];

type SessionPayload = {
  user: AuthUser | null;
  pool: PoolInfo | null;
  entries: PoolEntry[];
  error?: string;
};

type LocalStoredAccount = {
  email: string;
  password: string;
  session: SessionPayload;
};

function parseAmericanOdds(odds: string) {
  const numeric = Number(odds.replace('+', ''));

  if (Number.isNaN(numeric) || numeric === 0) {
    return 0;
  }

  if (numeric > 0) {
    return 100 / (numeric + 100);
  }

  return Math.abs(numeric) / (Math.abs(numeric) + 100);
}

function normalizeValue(value: number, min: number, max: number) {
  if (max === min) {
    return 1;
  }

  return (value - min) / (max - min);
}

function buildPricedPlayers(
  playerPool: ReadonlyArray<{
    id: number;
    name: string;
    defaultOdds: string;
    worldRank: number;
    pgaTourId: number;
    photoUrl?: string;
  }>,
  liveOddsMap: Record<string, string>,
  salaryOverrides?: Record<number, number>,
) {
  const playersWithOdds = playerPool.map((player) => ({
    ...player,
    odds: liveOddsMap[normalizeName(player.name)] ?? player.defaultOdds,
  }));
  const impliedProbabilities = playersWithOdds.map((player) => parseAmericanOdds(player.odds));
  const minProbability = Math.min(...impliedProbabilities);
  const maxProbability = Math.max(...impliedProbabilities);

  return playersWithOdds.map((player) => {
    const oddsScore = normalizeValue(parseAmericanOdds(player.odds), minProbability, maxProbability);
    const salary = salaryOverrides?.[player.id] ??
      Math.round((SALARY_MIN + oddsScore * (SALARY_MAX - SALARY_MIN)) / 100) * 100;

    return {
      id: player.id,
      name: player.name,
      worldRank: player.worldRank,
      odds: player.odds,
      salary,
      pgaTourId: player.pgaTourId,
      photoUrl: player.photoUrl,
    };
  });
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatRosterField(roster: number[] | undefined) {
  return (roster ?? []).join(', ');
}

function parseRosterField(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function canAccessCommissionerConsole(user: AuthUser | null) {
  if (!user) {
    return false;
  }

  return user.email.trim().toLowerCase() === COMMISSIONER_EMAIL && user.displayName.trim() === COMMISSIONER_DISPLAY_NAME;
}

function readStoredMainTab() {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(MAIN_TAB_STORAGE_KEY);
  return MAIN_TABS.includes(stored as MainTab) ? (stored as MainTab) : null;
}

function writeStoredMainTab(tab: MainTab) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(MAIN_TAB_STORAGE_KEY, tab);
}

function clearStoredMainTab() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(MAIN_TAB_STORAGE_KEY);
}

// Snapshots older than this are discarded so server-side admin changes
// (roster edits, stat overrides) are visible within one TTL window.
const SESSION_SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:session`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionPayload & { cachedAt?: number };
    // Treat missing or stale snapshots as absent — forces a fresh API fetch
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > SESSION_SNAPSHOT_TTL_MS) {
      return null;
    }
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

function writeStoredSession(payload: SessionPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    `${STORAGE_PREFIX}:session`,
    JSON.stringify({ ...payload, cachedAt: Date.now() }),
  );
}

function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(`${STORAGE_PREFIX}:session`);
}

function readStoredAccounts() {
  if (typeof window === 'undefined') {
    return [] as LocalStoredAccount[];
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:accounts`);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalStoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: LocalStoredAccount[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(`${STORAGE_PREFIX}:accounts`, JSON.stringify(accounts));
}

function upsertStoredAccount(session: SessionPayload, password?: string) {
  if (!session.user) {
    return;
  }

  const accounts = readStoredAccounts();
  const normalizedEmail = session.user.email.trim().toLowerCase();
  const existing = accounts.find((account) => account.email.trim().toLowerCase() === normalizedEmail);

  if (existing) {
    existing.session = session;
    if (password) {
      existing.password = password;
    }
  } else if (password) {
    accounts.push({
      email: session.user.email,
      password,
      session,
    });
  }

  writeStoredAccounts(accounts);
}

function findStoredAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return readStoredAccounts().find(
    (account) => account.email.trim().toLowerCase() === normalizedEmail && account.password === password,
  ) ?? null;
}

function findStoredAccountByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return readStoredAccounts().find((account) => account.email.trim().toLowerCase() === normalizedEmail) ?? null;
}

function readRoster(tournamentId: TournamentId) {
  if (typeof window === 'undefined') {
    return DEFAULT_ROSTERS[tournamentId];
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return DEFAULT_ROSTERS[tournamentId];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_ROSTERS[tournamentId];
  } catch {
    return DEFAULT_ROSTERS[tournamentId];
  }
}

function saveGuestRoster(tournamentId: TournamentId, roster: number[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;
  window.localStorage.setItem(key, JSON.stringify(roster));
}

function readFeedCache(tournamentId: TournamentId): FeedResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:feed:${tournamentId}`);
    return raw ? (JSON.parse(raw) as FeedResponse) : null;
  } catch {
    return null;
  }
}

function writeFeedCache(tournamentId: TournamentId, data: FeedResponse): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:feed:${tournamentId}`, JSON.stringify(data));
  } catch {}
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Returns "Round 1" … "Round 4" based on how many days past tournament Thursday we are.
// Transitions happen at midnight CST (UTC-6) each day.
function getCurrentRoundLabel(startDate: Date, now: Date): string {
  const CST_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC-6
  const thuMidnightUtc = startOfDay(startDate).getTime() + CST_OFFSET_MS;
  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  if (nowMs >= thuMidnightUtc + 3 * dayMs) return 'Round 4';
  if (nowMs >= thuMidnightUtc + 2 * dayMs) return 'Round 3';
  if (nowMs >= thuMidnightUtc + 1 * dayMs) return 'Round 2';
  return 'Round 1';
}

function buildOccurrenceDate(referenceIso: string, year: number, dateOnly: Date) {
  const reference = new Date(referenceIso);
  return new Date(
    year,
    dateOnly.getMonth(),
    dateOnly.getDate(),
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds(),
  );
}

function getTournamentStartDate(tournamentId: TournamentId, year: number) {
  switch (tournamentId) {
    case 'players':
      return nthWeekdayOfMonth(year, 2, 4, 2);
    case 'masters':
      return nthWeekdayOfMonth(year, 3, 4, 2);
    case 'pga':
      return nthWeekdayOfMonth(year, 4, 4, 2);
    case 'us-open':
      return nthWeekdayOfMonth(year, 5, 4, 3);
    case 'open':
      return nthWeekdayOfMonth(year, 6, 4, 3);
  }
}

type TournamentCardStatus = {
  label: 'LOCKED' | 'UP NEXT' | 'ACTIVE' | 'IN PROGRESS';
  color: string;
  icon: 'lock' | 'trophy' | 'check';
} | null;

function getTournamentEventWindow(tournament: (typeof TOURNAMENTS)[number], year: number) {
  const startDate = getTournamentStartDate(tournament.id, year);
  const activeAt = addDays(startOfDay(startDate), -3);
  const inProgressAt = buildOccurrenceDate(tournament.lockAt, year, startDate);
  const concludeAt = addDays(startOfDay(startDate), 4);

  return {
    id: tournament.id,
    year,
    activeAt,
    inProgressAt,
    concludeAt,
    startDate,
  };
}

function getDisplayTournamentWindow(tournament: (typeof TOURNAMENTS)[number], now = new Date()) {
  const currentWindow = getTournamentEventWindow(tournament, now.getFullYear());
  if (now < currentWindow.concludeAt) {
    return currentWindow;
  }

  return getTournamentEventWindow(tournament, now.getFullYear() + 1);
}

function getTournamentCardStatuses(now = new Date()) {
  const currentYear = now.getFullYear();
  const windows = TOURNAMENTS.flatMap((tournament) => [
    getTournamentEventWindow(tournament, currentYear),
    getTournamentEventWindow(tournament, currentYear + 1),
  ]).sort((left, right) => left.activeAt.getTime() - right.activeAt.getTime());

  const nextUpcoming = windows.find((window) => now < window.activeAt) ?? null;
  const statuses: Partial<Record<TournamentId, TournamentCardStatus>> = {};

  for (const tournament of TOURNAMENTS) {
    const currentWindow = getTournamentEventWindow(tournament, currentYear);
    const nextWindow = getTournamentEventWindow(tournament, currentYear + 1);

    if (now < currentWindow.concludeAt && now >= currentWindow.inProgressAt) {
      statuses[tournament.id] = {
        label: 'IN PROGRESS',
        color: '#15803d',
        icon: 'check',
      };
      continue;
    }

    if (now < currentWindow.concludeAt && now >= currentWindow.activeAt) {
      statuses[tournament.id] = {
        label: 'ACTIVE',
        color: '#15803d',
        icon: 'check',
      };
      continue;
    }

    const upcomingWindow = now < currentWindow.concludeAt ? currentWindow : nextWindow;
    const isUpNext =
      nextUpcoming &&
      nextUpcoming.id === tournament.id &&
      nextUpcoming.year === upcomingWindow.year;

    if (isUpNext) {
      statuses[tournament.id] = {
        label: 'UP NEXT',
        color: '#234d80',
        icon: 'trophy',
      };
      continue;
    }

    statuses[tournament.id] = now >= currentWindow.concludeAt
      ? {
          label: 'LOCKED',
          color: '#be123c',
          icon: 'lock',
        }
      : null;
  }

  return statuses;
}

function getDefaultTournamentId(statuses: Partial<Record<TournamentId, TournamentCardStatus>>) {
  const priority: Array<NonNullable<TournamentCardStatus>['label']> = ['IN PROGRESS', 'ACTIVE', 'UP NEXT'];

  for (const label of priority) {
    const match = TOURNAMENTS.find((tournament) => statuses[tournament.id]?.label === label);
    if (match) {
      return match.id;
    }
  }

  return TOURNAMENTS[0].id;
}

function isLineupLocked(lockAt: string, now = Date.now()) {
  return new Date(lockAt).getTime() <= now;
}

function formatRefresh(value: string | null) {
  if (!value) {
    return 'Waiting for first sync';
  }

  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) {
    return 'Updated just now';
  }
  if (minutes === 1) {
    return 'Updated 1 minute ago';
  }
  return `Updated ${minutes} minutes ago`;
}

function formatTournamentStartDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(value);
}

async function readJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

function resetViewAfterMainTabChange() {
  if (typeof window === 'undefined') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const createdViewport = !viewport;
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }

  const previousViewport = viewport?.getAttribute('content');

  if (viewport) {
    const targetViewport = viewport;
    targetViewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');

    const settleView = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      if (createdViewport) {
        targetViewport.remove();
      } else if (previousViewport) {
        targetViewport.setAttribute('content', previousViewport);
      }
    };

    window.requestAnimationFrame(() => {
      window.setTimeout(settleView, 80);
    });
  }
}

function fieldStyle() {
  return {
    width: '100%',
    borderRadius: 14,
    border: '1px solid #d7e0e8',
    padding: '12px 14px',
    fontSize: 16,
    background: '#fff',
  } satisfies CSSProperties;
}

function formatPointValue(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

// Tied positions keep the T prefix with no ordinal (T7, T21).
// Solo positions get an ordinal suffix (1st, 2nd, 3rd).
function formatPosition(position: string): string {
  if (!position || position === '--') return position;
  if (position.startsWith('T')) return position; // tied — no suffix
  const num = Number(position);
  if (Number.isNaN(num)) return position; // CUT, WD, DQ, etc.
  return ordinal(position);
}

function formatLeaderboardPosition(position: string): string {
  if (!position || position === '--') return position;
  if (position.startsWith('T')) return position; // tied — keep as T7, T21, etc.
  const num = Number(position);
  if (Number.isNaN(num)) return position; // CUT, WD, DQ, etc.
  return String(num); // plain number, no ordinal suffix
}

function ordinal(position: string): string {
  const tie = position.startsWith('T');
  const num = Number(position.replace('T', ''));
  if (Number.isNaN(num)) return position;
  if (tie) return `T${num}`; // tied — no ordinal suffix
  const suffix = num % 100 >= 11 && num % 100 <= 13 ? 'th'
    : num % 10 === 1 ? 'st'
    : num % 10 === 2 ? 'nd'
    : num % 10 === 3 ? 'rd'
    : 'th';
  return `${num}${suffix}`;
}

function formatTeeTime(teeTimeStr: string): string {
  // ESPN format: "Thu May 14 14:05:00 PDT 2026"
  // ESPN stores times in EDT (UTC-4) but mislabels the timezone as "PDT" (UTC-7).
  // Extract HH:MM directly and subtract 1 hour to convert EDT → CDT.
  const espnMatch = teeTimeStr.match(/(\d{1,2}):(\d{2}):\d{2}/);
  if (espnMatch) {
    let h = parseInt(espnMatch[1], 10);
    const min = parseInt(espnMatch[2], 10);
    h -= 1; // EDT → CDT
    if (h < 0) h += 24;
    const suf = h >= 12 ? 'pm' : 'am';
    const disp = h % 12 || 12;
    const minStr = min === 0 ? '' : `:${String(min).padStart(2, '0')}`;
    return `${disp}${minStr} ${suf}`;
  }
  // Fallback for ISO UTC strings
  try {
    const d = new Date(teeTimeStr);
    if (!isNaN(d.getTime())) {
      const result = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
      });
      return result.replace(':00', '').replace(' AM', ' am').replace(' PM', ' pm');
    }
  } catch { /* fall through */ }
  return '--';
}

function formatCurrentRoundScore(value: string | undefined, fallback: string) {
  const candidate = value && value !== '--' ? value : fallback;

  if (!candidate || candidate === '--') {
    return '--';
  }

  if (candidate === 'E' || candidate === 'F' || candidate === 'CUT' || candidate === 'MDF' || candidate === 'WD' || candidate === 'DQ') {
    return candidate;
  }

  const numeric = Number(candidate);
  if (Number.isNaN(numeric)) {
    return candidate;
  }

  if (numeric === 0) {
    return 'E';
  }

  return numeric > 0 ? `+${numeric}` : `${numeric}`;
}

export default function Page() {
  const initialTournament = getDefaultTournamentId(getTournamentCardStatuses());
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  const [selectedTournament, setSelectedTournament] = useState<TournamentId>(initialTournament);
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTERS[initialTournament]);
  const [activeStandingEntryId, setActiveStandingEntryId] = useState<string | null>(null);
  const [activeStandingGolferId, setActiveStandingGolferId] = useState<number | null>(null);
  const [scorecardGolferName, setScorecardGolferName] = useState<string | null>(null);
  const [scorecardGolferPhoto, setScorecardGolferPhoto] = useState<{pgaTourId: number; photoUrl?: string} | null>(null);
  const [scorecardGolferTeeTime, setScorecardGolferTeeTime] = useState<string | null>(null);
  const [scorecardGolferThru, setScorecardGolferThru] = useState<string | null>(null);
  const [scorecardGolferBackNineStart, setScorecardGolferBackNineStart] = useState(false);
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const entryBreakdownRef = useRef<HTMLDivElement>(null);
  const [showPointsSystem, setShowPointsSystem] = useState(false);
  const [selectedLeaderboardPlayerId, setSelectedLeaderboardPlayerId] = useState<number | null>(null);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<'picked' | 'full'>('picked');
  const [fullLeaderboardRows, setFullLeaderboardRows] = useState<FullFieldPlayer[] | null>(null);
  const [expandedCutIds, setExpandedCutIds] = useState<Set<string>>(new Set());
  const expandedCutTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [leaderboardSortMode, setLeaderboardSortMode] = useState<'default' | 'round-desc' | 'round-asc'>('default');
  const [leaderboardPickedSort, setLeaderboardPickedSort] = useState<'default' | 'desc' | 'asc'>('default');
  const [showCutInfo, setShowCutInfo] = useState(false);
  const [feed, setFeed] = useState<FeedResponse | null>(() => readFeedCache(initialTournament));
  const [isLoading, setIsLoading] = useState(() => readFeedCache(initialTournament) === null);
  const [error, setError] = useState('');
  const [feedRefreshNonce, setFeedRefreshNonce] = useState(0);
  const [commissionerMembersRefreshNonce, setCommissionerMembersRefreshNonce] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  useEffect(() => {
    if (saveMessage === 'Lineup saved to your account for this tournament.') {
      const t = setTimeout(() => setSaveMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [saveMessage]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailExists, setForgotEmailExists] = useState(false);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [commissionerMembers, setCommissionerMembers] = useState<CommissionerMember[]>([]);
  const [commissionerBusy, setCommissionerBusy] = useState(false);
  const [commissionerError, setCommissionerError] = useState('');
  const [commissionerSuccess, setCommissionerSuccess] = useState('');
  const [commissionerConsoleView, setCommissionerConsoleView] = useState<'dashboard' | 'members' | 'member-picks'>('dashboard');
  const [commissionerMemberSearch, setCommissionerMemberSearch] = useState('');
  const [commissionerMemberSort, setCommissionerMemberSort] = useState<{ column: 'displayName' | 'email'; direction: 'asc' | 'desc' }>({ column: 'displayName', direction: 'asc' });
  const [entriesPlayerSearch, setEntriesPlayerSearch] = useState('');
  const [tieBreakInput, setTieBreakInput] = useState('');
  const [showRosterConfirm, setShowRosterConfirm] = useState(false);
  const [commissionerPlayerSearch, setCommissionerPlayerSearch] = useState('');
  const [commissionerMemberModalOpen, setCommissionerMemberModalOpen] = useState(false);
  const [commissionerMemberModalView, setCommissionerMemberModalView] = useState<'menu' | 'displayName' | 'email' | 'confirmDelete' | 'confirmClearPicks'>('menu');
  const [commissionerRosterMemberId, setCommissionerRosterMemberId] = useState<string | null>(null);
  const [commissionerRosterSelection, setCommissionerRosterSelection] = useState<number[]>([]);
  const [commissionerTieBreakInput, setCommissionerTieBreakInput] = useState('');
  const [payoutForm, setPayoutForm] = useState({
    first: '',
    second: '',
    third: '',
  });
  const [selectedCommissionerMemberId, setSelectedCommissionerMemberId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountPreferencesView, setAccountPreferencesView] = useState<'root' | 'preferences' | 'password' | 'displayName'>('root');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [accountDisplayName, setAccountDisplayName] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [myEntriesEditorOpen, setMyEntriesEditorOpen] = useState(false);
  const pickSheetOpenRef = useRef(false);
  const standingsColRef = useRef<HTMLElement>(null);
  const leaderboardColRef = useRef<HTMLElement>(null);
  const [myEntriesMenuOpen, setMyEntriesMenuOpen] = useState(false);
  const [myEntriesDetailView, setMyEntriesDetailView] = useState<'none' | 'history' | 'rename'>('none');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberCreateForm, setMemberCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [memberEditForm, setMemberEditForm] = useState({
    displayName: '',
    email: '',
    password: '',
    rosters: {
      players: '',
      masters: '',
      pga: '',
      'us-open': '',
      open: '',
    } as Record<TournamentId, string>,
  });

  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    if (isMobile) return;
    const left = standingsColRef.current;
    const right = leaderboardColRef.current;
    if (!left || !right) return;
    const cap = `${left.offsetHeight}px`;
    if (leaderboardSearch) {
      right.style.height = 'auto';
      right.style.maxHeight = cap;
    } else {
      right.style.height = cap;
      right.style.maxHeight = '';
    }
  });

  const tournament = TOURNAMENTS.find((item) => item.id === selectedTournament) ?? TOURNAMENTS[0];
  const canManagePool = canAccessCommissionerConsole(sessionUser);
  const tournamentCardStatuses = getTournamentCardStatuses(new Date(nowTick));
  const selectedTournamentStatus = tournamentCardStatuses[selectedTournament];
  const entriesTournamentId = getDefaultTournamentId(tournamentCardStatuses);
  const entriesTournament = TOURNAMENTS.find((item) => item.id === entriesTournamentId) ?? TOURNAMENTS[0];
  const entriesTournamentStatus = tournamentCardStatuses[entriesTournamentId];
  const entriesPicksOpenForTournament = entriesTournamentStatus?.label === 'ACTIVE';
  const entriesPreFieldView =
    entriesTournamentStatus?.label === 'UP NEXT' || entriesTournamentStatus === null;
  const entriesDefaultLocked = isLineupLocked(entriesTournament.lockAt, nowTick);
  const entriesLocked = pool?.lineupLocks?.[entriesTournamentId] ?? (entriesDefaultLocked || entriesTournamentStatus?.label === 'IN PROGRESS');
  const selectedTournamentPayouts = pool?.payouts?.[selectedTournament] ?? null;
  const commissionerTournamentPayouts = pool?.payouts?.[entriesTournamentId] ?? null;
  const commissionerTournamentLabel = entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name;
  const entriesTournamentCourseName =
    entriesTournamentId === 'players'
      ? 'TPC Sawgrass'
      : entriesTournamentId === 'masters'
        ? 'Augusta National Golf Club'
        : entriesTournamentId === 'pga'
          ? 'Aronimink Golf Club'
          : entriesTournamentId === 'us-open'
            ? 'Shinnecock Hills Golf Club'
            : 'Royal Birkdale Golf Club';
  const entriesTournamentPar = TOURNAMENT_PARS[entriesTournamentId];

  const restoreServerSessionFromStoredAccount = async (storedAccount: LocalStoredAccount) => {
    try {
      return await readJson<SessionPayload>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: storedAccount.email,
          password: storedAccount.password,
        }),
      });
    } catch (loginError) {
      const fallbackUser = storedAccount.session.user;

      if (!fallbackUser) {
        throw loginError;
      }

      const registered = await readJson<SessionPayload>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: fallbackUser.displayName,
          email: storedAccount.email,
          password: storedAccount.password,
        }),
      });

      let latestSession = registered;

      for (const tournamentId of TOURNAMENTS.map((item) => item.id)) {
        const roster = fallbackUser.rosters[tournamentId] ?? [];

        if (roster.length > 0) {
          latestSession = await readJson<SessionPayload & { roster: number[] }>('/api/roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId, roster }),
          });
        }
      }

      return latestSession;
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      setSessionLoading(true);
      const storedSnapshot = readStoredSession();

      if (storedSnapshot?.user) {
        setSessionUser(storedSnapshot.user);
        setPool(storedSnapshot.pool);
        setPoolEntries(storedSnapshot.entries);
      }

      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        if (payload.user) {
          setSessionUser(payload.user);
          setPool(payload.pool);
          setPoolEntries(payload.entries);
          writeStoredSession(payload);
          upsertStoredAccount(payload);
        } else {
          const stored = readStoredSession();
          const storedAccount = stored?.user ? findStoredAccountByEmail(stored.user.email) : null;

          if (storedAccount) {
            const restored = await restoreServerSessionFromStoredAccount(storedAccount);
            setSessionUser(restored.user);
            setPool(restored.pool);
            setPoolEntries(restored.entries);
            writeStoredSession(restored);
            upsertStoredAccount(restored, storedAccount.password);
          } else {
            setSessionUser(null);
            setPool(null);
            setPoolEntries([]);
            clearStoredSession();
          }
        }
      } catch {
        const stored = readStoredSession();
        const storedAccount = stored?.user ? findStoredAccountByEmail(stored.user.email) : null;

        if (storedAccount) {
          try {
            const restored = await restoreServerSessionFromStoredAccount(storedAccount);
            setSessionUser(restored.user);
            setPool(restored.pool);
            setPoolEntries(restored.entries);
            writeStoredSession(restored);
            upsertStoredAccount(restored, storedAccount.password);
          } catch {
            setSessionUser(null);
            setPool(null);
            setPoolEntries([]);
            clearStoredSession();
          }
        } else {
          setSessionUser(null);
          setPool(null);
          setPoolEntries([]);
        }
      } finally {
        setSessionLoading(false);
      }
    };

    const silentRefresh = async () => {
      if (pickSheetOpenRef.current) return;
      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        if (payload.user) {
          setSessionUser(payload.user);
          setPool(payload.pool);
          setPoolEntries(payload.entries);
          writeStoredSession(payload);
        }
      } catch {
        // silent — don't disrupt the UI on background refresh
      }
    };

    void loadSession();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void silentRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const refreshTimer = window.setInterval(() => void silentRefresh(), 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    pickSheetOpenRef.current = myEntriesEditorOpen || !!commissionerRosterMemberId;
  }, [myEntriesEditorOpen, commissionerRosterMemberId]);

  useEffect(() => {
    if (!myEntriesEditorOpen) setEntriesPlayerSearch('');
  }, [myEntriesEditorOpen]);

  useEffect(() => {
    if (!commissionerRosterMemberId) setCommissionerPlayerSearch('');
  }, [commissionerRosterMemberId]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (sessionUser) {
      writeStoredSession({
        user: sessionUser,
        pool,
        entries: poolEntries,
      });
      return;
    }

    clearStoredSession();
  }, [pool, poolEntries, sessionLoading, sessionUser]);

  useEffect(() => {
    if (sessionUser) {
      setSelectedRoster(sessionUser.rosters[entriesTournamentId] ?? DEFAULT_ROSTERS[entriesTournamentId]);
      return;
    }

    setSelectedRoster(readRoster(entriesTournamentId));
  }, [entriesTournamentId, sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      saveGuestRoster(entriesTournamentId, selectedRoster);
    }
  }, [entriesTournamentId, selectedRoster, sessionUser]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mainTab === 'Commissioner Hub' && !canManagePool) {
      setMainTab('Standings');
    }
  }, [canManagePool, mainTab]);

  useEffect(() => {
    setPayoutForm({
      first: commissionerTournamentPayouts?.first ? String(commissionerTournamentPayouts.first) : '',
      second: commissionerTournamentPayouts?.second ? String(commissionerTournamentPayouts.second) : '',
      third: commissionerTournamentPayouts?.third ? String(commissionerTournamentPayouts.third) : '',
    });
  }, [commissionerTournamentPayouts?.first, commissionerTournamentPayouts?.second, commissionerTournamentPayouts?.third]);

  useEffect(() => {
    let active = true;

    const cached = readFeedCache(selectedTournament);
    if (cached) {
      setFeed(cached);
      setIsLoading(false);
    } else {
      setFeed(null);
      setIsLoading(true);
    }

    const loadFeed = async () => {
      if (!readFeedCache(selectedTournament)) {
        setIsLoading(true);
      }
      setError('');

      try {
        const payload = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}`, {
          cache: 'no-store',
        });

        if (active) {
          setFeed(payload);
          writeFeedCache(selectedTournament, payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadFeed();
    const timer = window.setInterval(() => {
      void loadFeed();
    }, 90000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [feedRefreshNonce, selectedTournament]);

  useEffect(() => {
    setExpandedCutIds(new Set());
    expandedCutTimersRef.current.forEach((t) => clearTimeout(t));
    expandedCutTimersRef.current.clear();
  }, [selectedTournament, mainTab]);

  useEffect(() => {
    if ((feed?.currentRound ?? 0) < 3 || fullLeaderboardRows) return;
    readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}&fullField=true`, { cache: 'no-store' })
      .then((data) => setFullLeaderboardRows(data.fullLeaderboard ?? []))
      .catch(() => { /* non-critical */ });
  }, [feed?.currentRound, selectedTournament, fullLeaderboardRows]);

  useEffect(() => {
    const loadCommissionerMembers = async () => {
      if (!sessionUser || !canManagePool || mainTab !== 'Commissioner Hub') {
        return;
      }

      setCommissionerBusy(true);
      setCommissionerError('');

      try {
        const payload = await readJson<{ members: CommissionerMember[] }>('/api/commissioner/members', {
          cache: 'no-store',
        });
        setCommissionerMembers(payload.members);
      } catch (err) {
        setCommissionerError(err instanceof Error ? err.message : 'Unable to load pool members.');
      } finally {
        setCommissionerBusy(false);
      }
    };

    void loadCommissionerMembers();
  }, [canManagePool, commissionerMembersRefreshNonce, mainTab, sessionUser]);

  useEffect(() => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    const member = commissionerMembers.find((item) => item.id === selectedCommissionerMemberId);

    if (!member) {
      setSelectedCommissionerMemberId(null);
      return;
    }

    setMemberEditForm({
      displayName: member.displayName,
      email: member.email,
      password: '',
      rosters: {
        players: formatRosterField(member.rosters.players),
        masters: formatRosterField(member.rosters.masters),
        pga: formatRosterField(member.rosters.pga),
        'us-open': formatRosterField(member.rosters['us-open']),
        open: formatRosterField(member.rosters.open),
      },
    });
  }, [selectedCommissionerMemberId, commissionerMembers]);

  useEffect(() => {
    setAccountDisplayName(sessionUser?.displayName ?? '');
  }, [sessionUser]);

  useEffect(() => {
    if (!commissionerSuccess) return;
    const timer = window.setTimeout(() => setCommissionerSuccess(''), 6000);
    return () => window.clearTimeout(timer);
  }, [commissionerSuccess]);

  useEffect(() => {
    setCommissionerSuccess('');
  }, [mainTab, commissionerConsoleView]);

  useEffect(() => {
    const anyOpen = !!activeStandingEntryId || !!activeStandingGolferId || !!scorecardGolferName;
    if (!anyOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [activeStandingEntryId, activeStandingGolferId, scorecardGolferName]);

  useEffect(() => {
    if (!selectedLeaderboardPlayerId) return;
    const topEntry = standings.find((entry) =>
      entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
    );
    if (!topEntry) return;
    const el = document.querySelector<HTMLElement>(`[data-entry-id="${topEntry.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // standings is a derived value; we only want to scroll on player selection changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaderboardPlayerId]);

  const applySession = (payload: SessionPayload) => {
    setSessionUser(payload.user);
    setPool(payload.pool);
    setPoolEntries(payload.entries);
    if (payload.user) {
      writeStoredSession(payload);
      upsertStoredAccount(payload);
    } else {
      clearStoredSession();
    }
    setAuthError('');
  };

  const refreshCurrentSession = async () => {
    try {
      const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });

      if (payload.user) {
        applySession(payload);
        return;
      }

      const stored = readStoredSession();
      const storedAccount = stored?.user ? findStoredAccountByEmail(stored.user.email) : null;

      if (storedAccount) {
        const restored = await restoreServerSessionFromStoredAccount(storedAccount);
        upsertStoredAccount(restored, storedAccount.password);
        applySession(restored);
      }
    } catch {
      // Keep the current UI in place if a soft refresh misses the network.
    }
  };

  const handleRegister = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      upsertStoredAccount(payload, registerForm.password);
      applySession(payload);
      setRegisterForm({ displayName: '', email: '', password: '' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      upsertStoredAccount(payload, loginForm.password);
      applySession(payload);
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      const fallbackAccount = findStoredAccount(loginForm.email, loginForm.password);

      if (fallbackAccount) {
        try {
          const restored = await restoreServerSessionFromStoredAccount(fallbackAccount);
          upsertStoredAccount(restored, fallbackAccount.password);
          applySession(restored);
          setLoginForm({ email: '', password: '' });
        } catch {
          setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
        }
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      await readJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      setSessionUser(null);
      setPool(null);
      setPoolEntries([]);
      setCommissionerMembers([]);
      setSelectedCommissionerMemberId(null);
      setAccountMenuOpen(false);
      setAccountPreferencesView('root');
      setAccountPassword('');
      setAccountDisplayName('');
      setAccountMessage('');
      clearStoredSession();
      clearStoredMainTab();
      setMainTab('Standings');
      setSaveMessage('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateOwnPassword = async () => {
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const payload = await readJson<{ user: AuthUser }>('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accountPassword }),
      });

      upsertStoredAccount(
        {
          user: payload.user,
          pool,
          entries: poolEntries,
        },
        accountPassword,
      );
      setSessionUser(payload.user);
      setAccountPassword('');
      setAccountMessage('Password updated.');
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleUpdateOwnDisplayName = async () => {
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const payload = await readJson<{ user: AuthUser }>('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: accountDisplayName }),
      });

      setSessionUser(payload.user);
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.user.id ? { ...entry, name: payload.user.displayName, rosters: payload.user.rosters } : entry,
        ),
      );
      upsertStoredAccount({
        user: payload.user,
        pool,
        entries: poolEntries.map((entry) =>
          entry.id === payload.user.id ? { ...entry, name: payload.user.displayName, rosters: payload.user.rosters } : entry,
        ),
      });
      setAccountMessage('Display name updated.');
      setMyEntriesDetailView('none');
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Unable to update display name.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleCreateMember = async () => {
    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>('/api/commissioner/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberCreateForm),
      });

      setCommissionerMembers((current) => [...current, payload.member]);
      setPoolEntries((current) => [...current, { id: payload.member.id, name: payload.member.displayName, rosters: payload.member.rosters, tieBreaks: payload.member.tieBreaks ?? {} }]);
      setMemberCreateForm({ displayName: '', email: '', password: '' });
      setShowAddMemberForm(false);
      setCommissionerSuccess('Member added.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleToggleLineupLock = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/lineup-lock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          locked: !locked,
        }),
      });

      setPool(payload.pool);
      setCommissionerSuccess(`Lineup lock ${payload.pool.lineupLocks[selectedTournament] ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update lineup lock.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleSavePayouts = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: entriesTournamentId,
          first: Number(payoutForm.first),
          second: Number(payoutForm.second),
          third: Number(payoutForm.third),
        }),
      });

      setPool(payload.pool);
      setCommissionerSuccess(
        `${entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name} payouts saved.`,
      );
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update payouts.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleSelectCommissionerMember = (memberId: string) => {
    setSelectedCommissionerMemberId(memberId);
    setCommissionerError('');
    setCommissionerSuccess('');
  };

  const openCommissionerMemberModal = (memberId: string) => {
    handleSelectCommissionerMember(memberId);
    setCommissionerMemberModalView('menu');
    setCommissionerMemberModalOpen(true);
  };

  const openCommissionerMemberPicks = (memberId: string) => {
    const member = commissionerMembers.find((item) => item.id === memberId);

    if (!member) {
      return;
    }

    setSelectedCommissionerMemberId(memberId);
    setCommissionerRosterMemberId(memberId);
    setCommissionerRosterSelection(member.rosters[entriesTournamentId] ?? []);
    const existingTieBreak = member.tieBreaks?.[entriesTournamentId];
    setCommissionerTieBreakInput(existingTieBreak != null ? String(existingTieBreak) : '');
    setCommissionerMemberModalOpen(false);
    setCommissionerConsoleView('member-picks');
    setCommissionerError('');
    setCommissionerSuccess('');
  };

  const handleSaveCommissionerMember = async () => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${selectedCommissionerMemberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: memberEditForm.displayName,
            email: memberEditForm.email,
            password: memberEditForm.password,
            rosters: {
              players: parseRosterField(memberEditForm.rosters.players),
              masters: parseRosterField(memberEditForm.rosters.masters),
              pga: parseRosterField(memberEditForm.rosters.pga),
              'us-open': parseRosterField(memberEditForm.rosters['us-open']),
              open: parseRosterField(memberEditForm.rosters.open),
            },
          }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id ? { ...entry, name: payload.member.displayName, rosters: payload.member.rosters } : entry,
        ),
      );
      setSessionUser((current) =>
        current && current.id === payload.member.id ? payload.member : current,
      );
      setCommissionerSuccess('Member updated.');
      setMemberEditForm((current) => ({ ...current, password: '' }));
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleDeleteCommissionerMember = async () => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      await readJson<{ ok: boolean }>(`/api/commissioner/members/${selectedCommissionerMemberId}`, {
        method: 'DELETE',
      });

      setCommissionerMembers((current) => current.filter((member) => member.id !== selectedCommissionerMemberId));
      setPoolEntries((current) => current.filter((entry) => entry.id !== selectedCommissionerMemberId));
      setSessionUser((current) => (current?.id === selectedCommissionerMemberId ? null : current));
      setPool((current) => (sessionUser?.id === selectedCommissionerMemberId ? null : current));
      setSelectedCommissionerMemberId(null);
      setCommissionerRosterMemberId((current) => (current === selectedCommissionerMemberId ? null : current));
      setCommissionerMemberModalOpen(false);
      setCommissionerConsoleView((current) => (current === 'member-picks' ? 'members' : current));
      setCommissionerSuccess('Member deleted.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to delete member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleClearCommissionerMemberPicks = async () => {
    if (!selectedCommissionerMemberId) return;

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${selectedCommissionerMemberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rosters: { [entriesTournamentId]: [] }, tieBreaks: { [entriesTournamentId]: null } }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id
            ? { ...entry, rosters: payload.member.rosters }
            : entry,
        ),
      );
      setSessionUser((current) =>
        current && current.id === payload.member.id ? payload.member : current,
      );
      setCommissionerMemberModalOpen(false);
      setCommissionerMemberModalView('menu');
      setCommissionerSuccess(`Picks cleared for ${payload.member.displayName}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to clear picks.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const toggleCommissionerRosterPlayer = (playerId: number) => {
    if (commissionerRosterSelection.includes(playerId)) {
      setCommissionerRosterSelection(commissionerRosterSelection.filter((id) => id !== playerId));
      return;
    }

    if (commissionerRosterSelection.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...commissionerRosterSelection, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setCommissionerRosterSelection(next);
  };

  const handleSaveCommissionerRoster = async () => {
    if (!commissionerRosterMember) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${commissionerRosterMember.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rosters: {
              [entriesTournamentId]: commissionerRosterSelection,
            },
            tieBreaks: {
              [entriesTournamentId]: parseInt(commissionerTieBreakInput, 10),
            },
          }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id
            ? { ...entry, name: payload.member.displayName, rosters: payload.member.rosters }
            : entry,
        ),
      );
      setSessionUser((current) => (current && current.id === payload.member.id ? payload.member : current));
      setCommissionerSuccess(`${payload.member.displayName}'s ${commissionerTournamentLabel} picks were saved.`);
      setCommissionerConsoleView('members');
      setCommissionerRosterMemberId(null);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to save member picks.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const feedMap = useMemo(() => {
    const rows = feed?.players ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName ?? ''), row])) as Record<
      string,
      FeedRow
    >;
  }, [feed]);

  const liveOddsMap = useMemo(() => {
    const rows = feed?.odds ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName), row.odds])) as Record<
      string,
      string
    >;
  }, [feed]);

  const players = useMemo(
    () =>
      buildPricedPlayers(PLAYER_POOL, liveOddsMap, PGA_SALARY_OVERRIDES).map((player) => {
        const live = feedMap[normalizeName(player.name)];
        const score = live?.score ?? '--';
        const position = live?.position ?? '--';
        const thru = live?.thru ?? '--';
        const scoreBreakdown =
          live?.scoreBreakdown ??
          buildPlaceholderScoreBreakdown({ position, score, thru });

        return {
          ...player,
          position,
          thru,
          score,
          total: live?.total ?? '--',
          currentRoundScore: live?.currentRoundScore ?? null,
          backNineStart: live?.backNineStart ?? false,
          teeTime: live?.teeTime ?? null,
          points: scoreBreakdown.totalPoints,
          holesRemaining: (score === 'CUT' || score === 'MDF') ? 0 : scoreBreakdown.holesRemaining,
          scoreBreakdown,
          originalScore: live?.originalScore,
        };
      }),
    [feedMap, liveOddsMap],
  );

  const playersById = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player])),
    [players],
  );
  const selectedCommissionerMember =
    commissionerMembers.find((member) => member.id === selectedCommissionerMemberId) ?? null;
  const filteredCommissionerMembers = commissionerMembers
    .filter((member) => {
      const query = commissionerMemberSearch.trim().toLowerCase();
      if (!query) return true;
      return member.displayName.toLowerCase().includes(query) || member.email.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const valA = a[commissionerMemberSort.column].toLowerCase();
      const valB = b[commissionerMemberSort.column].toLowerCase();
      const cmp = valA.localeCompare(valB);
      return commissionerMemberSort.direction === 'asc' ? cmp : -cmp;
    });
  const commissionerRosterMember =
    commissionerMembers.find((member) => member.id === commissionerRosterMemberId) ?? null;
  const filteredEntriesPlayers = players
    .filter((player) => {
      if (selectedRoster.includes(player.id)) return false;
      const query = entriesPlayerSearch.trim().toLowerCase();
      if (!query) return true;
      return player.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.salary - a.salary);
  const filteredCommissionerPlayers = players
    .filter((player) => {
      if (commissionerRosterSelection.includes(player.id)) return false;
      const query = commissionerPlayerSearch.trim().toLowerCase();
      if (!query) return true;
      return player.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.salary - a.salary);

  const savedRoster = sessionUser?.rosters[entriesTournamentId] ?? [];
  const hasSubmittedRoster = savedRoster.length === REQUIRED_GOLFERS;
  const submittedEntries = poolEntries.filter((entry) => (entry.rosters[entriesTournamentId] ?? []).length === REQUIRED_GOLFERS);
  const otherSubmittedEntriesCount = sessionUser
    ? submittedEntries.filter((entry) => entry.id !== sessionUser.id).length
    : submittedEntries.length;
  const submittedCommissionerMembers = commissionerMembers.filter(
    (member) => (member.rosters[entriesTournamentId] ?? []).length === REQUIRED_GOLFERS,
  );
  const pendingCommissionerMembers = commissionerMembers.filter(
    (member) => (member.rosters[entriesTournamentId] ?? []).length !== REQUIRED_GOLFERS,
  );
  const rosterPlayers = selectedRoster.map((id) => playersById[id]).filter(Boolean);
  const orderedRosterPlayers = [...rosterPlayers].sort((left, right) => right.salary - left.salary);
  const savedRosterPlayers = savedRoster.map((id) => playersById[id]).filter(Boolean);
  const salaryUsed = rosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const playersNeeded = Math.max(0, REQUIRED_GOLFERS - selectedRoster.length);
  const averageRemainingPerPlayer =
    playersNeeded > 0 ? Math.max(0, Math.floor(salaryRemaining / playersNeeded)) : 0;
  const commissionerRosterPlayers = commissionerRosterSelection.map((id) => playersById[id]).filter(Boolean);
  const commissionerOrderedRosterPlayers = [...commissionerRosterPlayers].sort(
    (left, right) => right.salary - left.salary,
  );
  const commissionerSalaryUsed = commissionerRosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const commissionerSalaryRemaining = SALARY_CAP - commissionerSalaryUsed;
  const commissionerPlayersNeeded = Math.max(0, REQUIRED_GOLFERS - commissionerRosterSelection.length);
  const commissionerAverageRemainingPerPlayer =
    commissionerPlayersNeeded > 0
      ? Math.max(0, Math.floor(commissionerSalaryRemaining / commissionerPlayersNeeded))
      : 0;
  const canSaveCommissionerRoster =
    !!commissionerRosterMember &&
    commissionerRosterSelection.length === REQUIRED_GOLFERS &&
    commissionerSalaryUsed <= SALARY_CAP &&
    /^\d{3}$/.test(commissionerTieBreakInput);
  const defaultLocked = isLineupLocked(tournament.lockAt, nowTick);
  const locked = pool?.lineupLocks?.[selectedTournament] ?? (defaultLocked || selectedTournamentStatus?.label === 'IN PROGRESS');
  const showFinalTournamentView = selectedTournamentStatus?.label === 'LOCKED';
  const showProjectedCut = (() => {
    if (selectedTournamentStatus?.label !== 'IN PROGRESS') return false;
    const showAt = TOURNAMENT_CUT_SHOW_AT[selectedTournament];
    if (!showAt) return false;
    const now = Date.now();
    if (now < new Date(showAt).getTime()) return false;
    const hideAt = TOURNAMENT_CUT_HIDE_AT[selectedTournament];
    return hideAt ? now < new Date(hideAt).getTime() : true;
  })();
  const showFutureTournamentView =
    selectedTournamentStatus?.label === 'UP NEXT' ||
    selectedTournamentStatus?.label === 'ACTIVE' ||
    selectedTournamentStatus === null;
  const showLivePayoutStrip =
    selectedTournamentStatus?.label === 'IN PROGRESS' || selectedTournamentStatus?.label === 'LOCKED';
  const displayTournamentWindow = getDisplayTournamentWindow(tournament, new Date(nowTick));
  const currentRoundLabel = selectedTournamentStatus?.label === 'LOCKED'
    ? 'Round 4'
    : getCurrentRoundLabel(displayTournamentWindow.startDate, new Date(nowTick));
  const picksOpenForTournament = selectedTournamentStatus?.label === 'ACTIVE';
  const tournamentStartLabel = formatTournamentStartDate(displayTournamentWindow.inProgressAt);

  const userLabel = sessionUser?.displayName ?? 'Guest lineup';
  const liveStandingEntries = (
    poolEntries.length > 0
      ? poolEntries
      : [
          {
            id: sessionUser?.id ?? 'guest-entry',
            name: userLabel,
            rosters: {
              [selectedTournament]:
                sessionUser?.rosters[selectedTournament] ??
                (selectedTournament === entriesTournamentId ? selectedRoster : DEFAULT_ROSTERS[selectedTournament]),
            },
            tieBreaks: sessionUser?.tieBreaks ?? {},
          },
          ...STATIC_ENTRIES,
        ]
  );

  const standings: StandingEntry[] = liveStandingEntries
    .map((entry) => {
      const isPlayersTab = selectedTournament === 'players';
      const isCommissioner = entry.name === COMMISSIONER_DISPLAY_NAME;

      // For The Players tab: zero out everyone except Clayton Tucker
      if (isPlayersTab && !isCommissioner) {
        return {
          ...entry,
          picks: Array(REQUIRED_GOLFERS).fill(0) as number[],
          golfers: [],
          rosterPoints: 0,
          holesRemaining: 0,
          tieBreakValue: 0,
        };
      }

      const savedRoster = entry.rosters[selectedTournament];
      const picks =
        savedRoster && savedRoster.length > 0
          ? savedRoster
          : isCommissioner
            ? DEFAULT_ROSTERS[selectedTournament]
            : [];
      const golfers = picks.map((id) => playersById[id]).filter(Boolean);
      const rosterPoints = golfers.reduce((sum, golfer) => sum + golfer.points, 0);
      const holesRemaining = golfers.reduce((sum, golfer) => sum + golfer.holesRemaining, 0);
      const tieBreakValue = entry.tieBreaks?.[selectedTournament] ?? (picks.reduce((sum, id) => sum + id, 0) + 270);

      return {
        ...entry,
        picks,
        golfers,
        rosterPoints,
        holesRemaining,
        tieBreakValue,
      };
    })
    .filter((entry) => selectedTournament === 'players' || entry.picks.length === REQUIRED_GOLFERS)
    .sort((left, right) => {
      if (right.rosterPoints !== left.rosterPoints) {
        return right.rosterPoints - left.rosterPoints;
      }

      if (left.holesRemaining !== right.holesRemaining) {
        return left.holesRemaining - right.holesRemaining;
      }

      return left.tieBreakValue - right.tieBreakValue;
    })
    .map((entry, index) => ({ ...entry, place: index + 1 }));

  const activeStandingEntry = standings.find((entry) => entry.id === activeStandingEntryId) ?? null;
  const activeStandingGolfers = activeStandingEntry
    ? [...activeStandingEntry.golfers].sort((left, right) => {
        if (right.points !== left.points) {
          return right.points - left.points;
        }

        const leftPos = Number(left.position.replace('T', ''));
        const rightPos = Number(right.position.replace('T', ''));

        if (!Number.isNaN(leftPos) && !Number.isNaN(rightPos) && leftPos !== rightPos) {
          return leftPos - rightPos;
        }

        return left.salary - right.salary;
      })
    : [];
  const activeStandingGolfer = activeStandingGolfers.find((golfer) => golfer.id === activeStandingGolferId) ?? null;
  const pickedGolferIds = new Set(standings.flatMap((entry) => entry.golfers.map((golfer) => golfer.id)));
  const eventLeaderboardRows = [...players]
    .filter((player) => pickedGolferIds.has(player.id))
    .sort((left, right) => {
      const leftPos = Number(left.position.replace('T', ''));
      const rightPos = Number(right.position.replace('T', ''));

      if (!Number.isNaN(leftPos) && !Number.isNaN(rightPos) && leftPos !== rightPos) {
        return leftPos - rightPos;
      }

      return right.points - left.points;
    });

  const tieBreakValid = /^\d{3}$/.test(tieBreakInput);
  const canSave =
    Boolean(sessionUser) &&
    selectedRoster.length === REQUIRED_GOLFERS &&
    salaryUsed <= SALARY_CAP &&
    !entriesLocked;

  const togglePlayer = (playerId: number) => {
    if (entriesLocked) {
      return;
    }

    if (selectedRoster.includes(playerId)) {
      setSelectedRoster(selectedRoster.filter((id) => id !== playerId));
      return;
    }

    if (selectedRoster.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...selectedRoster, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setSelectedRoster(next);
  };

  const handleSave = async () => {
    if (!sessionUser) {
      setSaveMessage('Create an account or sign in to save this lineup to the pool.');
      return;
    }

    if (!canSave) {
      setSaveMessage('Lineup must have 6 golfers, stay under the salary cap, and be saved before lock.');
      return;
    }

    try {
      const payload = await readJson<SessionPayload & { roster: number[] }>('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: entriesTournamentId,
          roster: selectedRoster,
          tieBreak: parseInt(tieBreakInput, 10),
        }),
      });

      applySession(payload);
      setSaveMessage('Lineup saved to your account for this tournament.');
      setMyEntriesEditorOpen(false);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save lineup.');
    }
  };

  const handleCutClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCutIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        const t = expandedCutTimersRef.current.get(playerId);
        if (t !== undefined) clearTimeout(t);
        expandedCutTimersRef.current.delete(playerId);
        next.delete(playerId);
      } else {
        next.add(playerId);
        const t = setTimeout(() => {
          setExpandedCutIds((s) => { const n = new Set(s); n.delete(playerId); return n; });
          expandedCutTimersRef.current.delete(playerId);
        }, 10000);
        expandedCutTimersRef.current.set(playerId, t);
      }
      return next;
    });
  };

  const handleMainTabChange = (tab: MainTab, options?: { refreshAfterChange?: boolean }) => {
    setAccountMenuOpen(false);
    setMyEntriesMenuOpen(false);
    setActiveStandingEntryId(null);
    setActiveStandingGolferId(null);
    setCommissionerMemberModalOpen(false);
    setNowTick(Date.now());

    startTransition(() => {
      if (tab === 'Standings') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date())));
        setFeedRefreshNonce((value) => value + 1);
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
      } else if (tab === 'My Entries') {
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Details') {
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Commissioner Hub') {
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
        setCommissionerMembersRefreshNonce((value) => value + 1);
      }

      setLeaderboardSearch('');
      setLeaderboardViewMode('picked');
      setFullLeaderboardRows(null);
      setLeaderboardSortMode('default');
      setLeaderboardPickedSort('default');
      setShowCutInfo(false);
      setMainTab(tab);
    });

    resetViewAfterMainTabChange();

    if (options?.refreshAfterChange) {
      void refreshCurrentSession();
    }
  };

  const openMyEntriesEditor = () => {
    setSaveMessage('');
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSelectedRoster(savedRoster.length > 0 ? savedRoster : []);
    const savedTieBreak = sessionUser?.tieBreaks?.[entriesTournamentId];
    setTieBreakInput(savedTieBreak != null ? String(savedTieBreak) : '');
    setMyEntriesEditorOpen(true);
    handleMainTabChange('My Entries');
    setMyEntriesEditorOpen(true);
  };

  const closeMyEntriesEditor = () => {
    setMyEntriesEditorOpen(false);
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSaveMessage('');
  };

  const renderRosterCards = (background: string, allowRemove = false) => (
    <div style={{ display: 'grid', gap: isMobile ? 10 : 10 }}>
      {orderedRosterPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #e6edf1',
            borderRadius: 16,
            padding: isMobile ? '16px 16px' : '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 10 }}>
            <img
              src={player.photoUrl ?? pgaPhoto(player.pgaTourId)}
              alt={player.name}
              className="roster-card-photo" style={{ width: isMobile ? 58 : 58, height: isMobile ? 58 : 58, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 17 : 20 }}>{player.name}</div>
              <div style={{ marginTop: 4, fontSize: isMobile ? 13 : 14, color: '#6b7b88' }}>
                OWGR {player.worldRank} | {player.odds} | <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, color: '#3f73ad' }}>${player.salary.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}>
            {allowRemove ? (
              <button
                type="button"
                onClick={() => togglePlayer(player.id)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: '1px solid #c9d7e6',
                  background: '#eef4ff',
                  color: '#2f5f96',
                  fontSize: 22,
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                −
              </button>
            ) : null}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: isMobile ? 20 : 20 }}>{player.points}</div>
              <div style={{ fontSize: isMobile ? 13 : 12, color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96' }}>{player.holesRemaining} holes left</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBudgetCards = (background: string, border: string) => (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 10,
      }}
    >
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Salary used</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${salaryUsed.toLocaleString()}</div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Remaining</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 22,
            fontWeight: 900,
            color: salaryRemaining < 0 ? '#b91c1c' : '#0f1720',
          }}
        >
          ${salaryRemaining.toLocaleString()}
        </div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
          Avg/player left
        </div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${averageRemainingPerPlayer.toLocaleString()}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#6b7b88' }}>
          {playersNeeded === 0 ? 'Roster complete' : `${playersNeeded} spot${playersNeeded === 1 ? '' : 's'} left`}
        </div>
      </div>
    </div>
  );

  const formatPayoutAmount = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : '--';

  if (sessionLoading && !sessionUser) {
    return (
      <div
        style={{
          minHeight: '100svh',
          background:
            'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '12px 10px 32px' : '32px 20px 40px' }}>
          <header
            style={{
              background: 'linear-gradient(135deg, #173b63 0%, #102842 100%)',
              color: '#fff',
              borderRadius: 28,
              padding: isMobile ? '10px 12px' : '10px 28px',
              boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src="/golf-majors-pool-logo-v11.png"
                alt="Golf Majors Pool"
                style={{
                  display: 'block',
                  width: isMobile ? 'min(100%, 260px)' : 'min(100%, 380px)',
                  height: 'auto',
                  objectFit: 'contain',
                  background: 'transparent',
                }}
              />
            </div>
          </header>
          <section
            style={{
              marginTop: 24,
              background: '#fff',
              borderRadius: 24,
              padding: isMobile ? 24 : 32,
              boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              textAlign: 'center',
              color: '#5b6b79',
              fontWeight: 800,
            }}
          >
            Loading your pool...
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        background:
          'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '12px 10px 32px' : '32px 20px 40px' }}>
        <header
          style={{
            background: 'linear-gradient(135deg, #173b63 0%, #102842 100%)',
            color: '#fff',
            borderRadius: 28,
            padding: isMobile ? (sessionUser ? '0px 12px 2px' : '2px 12px') : (sessionUser ? '10px 28px 6px' : '10px 28px'),
            boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src="/golf-majors-pool-logo-v11.png"
              alt="Golf Majors Pool"
              style={{
                display: 'block',
                width: isMobile ? 'min(100%, 278px)' : 'min(100%, 380px)',
                height: 'auto',
                objectFit: 'contain',
                background: 'transparent',
              }}
            />
          </div>

          {sessionUser ? (
            <div
              style={{
                marginTop: 0,
                paddingTop: 8,
                borderTop: '1px solid rgba(112, 202, 220, 0.18)',
                display: 'flex',
                justifyContent: (isMobile && canManagePool) ? 'flex-start' : 'center',
                gap: isMobile ? 0 : 4,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                paddingLeft: isMobile ? 4 : 32,
                paddingRight: isMobile ? 4 : 32,
                paddingBottom: 2,
              }}
            >
              {MAIN_TABS
                .filter((tab) => tab !== 'Commissioner Hub' || canManagePool)
                .map((tab) => {
                  const active = tab === mainTab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleMainTabChange(tab, { refreshAfterChange: true })}
                      style={{
                        border: 'none',
                        borderBottom: active ? '3px solid #63d9ea' : '3px solid transparent',
                        background: 'transparent',
                        color: active ? '#63d9ea' : '#ffffff',
                        padding: isMobile ? '6px 10px 8px' : '7px 12px 9px',
                        fontSize: isMobile ? 13 : 15,
                        fontWeight: 800,
                        cursor: 'pointer',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        flex: '0 0 auto',
                      }}
                    >
                      {tab}
                    </button>
                  );
                })}
            </div>
          ) : null}

          {sessionUser && !canManagePool ? (
            <div style={{ position: 'absolute', right: isMobile ? 10 : 22, bottom: isMobile ? 6 : 6, zIndex: 30 }}>
              {accountMenuOpen ? (
                <button
                  type="button"
                  aria-label="Close account menu"
                  onClick={() => setAccountMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'default',
                    padding: 0,
                    margin: 0,
                    zIndex: 10,
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                  }}
                />
              ) : null}

              <button
                onClick={() => {
                  setAccountMenuOpen((current) => !current);
                  setAccountMessage('');
                  setAccountPreferencesView('root');
                  setAccountPassword('');
                  setAccountDisplayName(sessionUser.displayName);
                }}
                style={{
                  position: 'relative',
                  zIndex: 20,
                  width: (isMobile && !canManagePool) ? 34 : 42,
                  height: (isMobile && !canManagePool) ? 34 : 42,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#173b63',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CircleUserRound size={(isMobile && !canManagePool) ? 17 : 20} />
              </button>

              {accountMenuOpen ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: isMobile ? 'fixed' : 'absolute',
                    right: isMobile ? 10 : 0,
                    top: isMobile ? 100 : 'auto',
                    bottom: isMobile ? 'auto' : 54,
                    width: isMobile ? 270 : 336,
                    borderRadius: 18,
                    background: '#fff',
                    color: '#0f1720',
                    padding: isMobile ? 12 : 16,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.22)',
                    zIndex: 20,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Account
                  </div>
                  <div style={{ marginTop: 6, fontSize: isMobile ? 16 : 20, fontWeight: 900 }}>{sessionUser.displayName}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>{sessionUser.email}</div>

                  {accountPreferencesView === 'password' ? (
                    <div style={{ position: 'relative', marginTop: 14 }}>
                      <input
                        type={showAccountPassword ? 'text' : 'password'}
                        value={accountPassword}
                        onChange={(event) => setAccountPassword(event.target.value)}
                        placeholder="New password"
                        style={{ ...fieldStyle(), marginTop: 0, paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountPassword((v) => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7b88', display: 'flex', alignItems: 'center' }}
                      >
                        {showAccountPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  ) : null}

                  {accountPreferencesView === 'displayName' ? (
                    <input
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                      placeholder="Display name"
                      style={{ ...fieldStyle(), marginTop: 14 }}
                    />
                  ) : null}

                  {accountMessage ? (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color:
                          accountMessage === 'Password updated.' || accountMessage === 'Display name updated.'
                            ? '#2f5f96'
                            : '#a61b1b',
                      }}
                    >
                      {accountMessage}
                    </div>
                  ) : null}
                  <div style={{ marginTop: isMobile ? 10 : 14, display: 'flex', gap: 8 }}>
                    {accountPreferencesView === 'root' ? (
                      <button
                        onClick={() => {
                          setAccountPreferencesView('preferences');
                          setAccountMessage('');
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Preferences
                      </button>
                    ) : null}

                    {accountPreferencesView === 'preferences' ? (
                      <>
                        <button
                          onClick={() => {
                            setAccountPreferencesView('password');
                            setAccountMessage('');
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#173b63',
                            color: '#fff',
                            fontWeight: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Change</span>
                          <span>Password</span>
                        </button>
                        <button
                          onClick={() => {
                            setAccountPreferencesView('displayName');
                            setAccountMessage('');
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: '1px solid #d7e0e8',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#fff',
                            color: '#0f1720',
                            fontWeight: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Edit</span>
                          <span>Display Name</span>
                        </button>
                      </>
                    ) : null}

                    {accountPreferencesView === 'password' ? (
                      <button
                        onClick={handleUpdateOwnPassword}
                        disabled={accountBusy}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Password
                      </button>
                    ) : null}

                    {accountPreferencesView === 'displayName' ? (
                      <button
                        onClick={handleUpdateOwnDisplayName}
                        disabled={accountBusy}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Name
                      </button>
                    ) : null}

                    <button
                      onClick={handleLogout}
                      disabled={authBusy}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: '1px solid #d7e0e8',
                        borderRadius: 12,
                        padding: '12px 14px',
                        background: '#fff',
                        color: '#0f1720',
                        fontWeight: 800,
                        cursor: authBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {!sessionUser ? (
          <section
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 'min(480px, calc(100vw - 48px))',
                minHeight: 344,
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {authMode === 'login' ? <LogIn size={18} color="#2f5f96" /> : <UserPlus size={18} color="#2f5f96" />}
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </div>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); authMode === 'login' ? handleLogin() : handleRegister(); }}
                style={{ display: 'grid', gap: 12, flex: 1 }}
              >
                {authMode === 'register' ? (
                  <input
                    value={registerForm.displayName}
                    onChange={(event) => setRegisterForm({ ...registerForm, displayName: event.target.value })}
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                ) : null}

                <input
                  value={authMode === 'login' ? loginForm.email : registerForm.email}
                  onChange={(event) =>
                    authMode === 'login'
                      ? setLoginForm({ ...loginForm, email: event.target.value })
                      : setRegisterForm({ ...registerForm, email: event.target.value })
                  }
                  placeholder="Email"
                  style={fieldStyle()}
                />
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid #d7e0e8', background: '#fff' }}>
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    value={authMode === 'login' ? loginForm.password : registerForm.password}
                    onChange={(event) =>
                      authMode === 'login'
                        ? setLoginForm({ ...loginForm, password: event.target.value })
                        : setRegisterForm({ ...registerForm, password: event.target.value })
                    }
                    placeholder="Password"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, background: 'transparent', minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((v) => !v)}
                    style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7b88', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    {showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  type="submit"
                  style={{
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background:
                      authMode === 'login'
                        ? 'linear-gradient(135deg, #487dc2 0%, #3c6ea9 100%)'
                        : 'linear-gradient(135deg, #315f95 0%, #284f7d 100%)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: authBusy ? 'wait' : 'pointer',
                  }}
                  disabled={authBusy}
                >
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              {authMode === 'register' && (
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  style={{ marginTop: 14, border: 'none', background: 'transparent', color: '#2f5f96', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Already have an account? Click here to sign in
                </button>
              )}

              {authMode === 'login' && (
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#2f5f96', display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotEmail('');
                      setForgotEmailExists(false);
                      setForgotNewPassword('');
                      setForgotMessage('');
                      setShowForgotNewPassword(false);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2f5f96', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Forgot Password?
                  </button>
                  <span style={{ color: '#5b6b79' }}>or sign up</span>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setAuthError(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2f5f96', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}
                  >
                    here
                  </button>
                </div>
              )}

              {forgotOpen && (
                <div
                  onClick={() => setForgotOpen(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 18px 48px rgba(9,34,51,0.25)' }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720', marginBottom: 16 }}>Forgot Password</div>

                    {!forgotEmailExists ? (
                      <>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="Enter your email"
                          style={{ ...fieldStyle(), width: '100%', boxSizing: 'border-box' }}
                        />
                        {forgotMessage && (
                          <div style={{ marginTop: 10, fontSize: 13, color: '#a61b1b' }}>{forgotMessage}</div>
                        )}
                        <button
                          type="button"
                          disabled={forgotBusy}
                          onClick={async () => {
                            setForgotBusy(true);
                            setForgotMessage('');
                            try {
                              const res = await fetch('/api/auth/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotEmail }),
                              });
                              const data = await res.json();
                              if (data.exists) {
                                setForgotEmailExists(true);
                              } else {
                                setForgotMessage('No account found with that email address.');
                              }
                            } catch {
                              setForgotMessage('Something went wrong. Please try again.');
                            } finally {
                              setForgotBusy(false);
                            }
                          }}
                          style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', background: 'linear-gradient(135deg, #487dc2 0%, #3c6ea9 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: forgotBusy ? 'wait' : 'pointer' }}
                        >
                          {forgotBusy ? 'Checking…' : 'Continue'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: '#5b6b79', marginBottom: 12 }}>
                          Account found for <strong>{forgotEmail}</strong>. Enter your new password below.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid #d7e0e8', background: '#fff' }}>
                          <input
                            type={showForgotNewPassword ? 'text' : 'password'}
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            placeholder="New password (min 8 chars)"
                            style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, background: 'transparent', minWidth: 0 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotNewPassword((v) => !v)}
                            style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7b88', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {forgotMessage && (
                          <div style={{ marginTop: 10, fontSize: 13, color: forgotMessage === 'Password updated successfully.' ? '#1f8d4e' : '#a61b1b' }}>{forgotMessage}</div>
                        )}
                        <button
                          type="button"
                          disabled={forgotBusy}
                          onClick={async () => {
                            setForgotBusy(true);
                            setForgotMessage('');
                            try {
                              const res = await fetch('/api/auth/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPassword }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setForgotMessage('Password updated successfully.');
                                setTimeout(() => setForgotOpen(false), 1500);
                              } else {
                                setForgotMessage(data.error ?? 'Something went wrong.');
                              }
                            } catch {
                              setForgotMessage('Something went wrong. Please try again.');
                            } finally {
                              setForgotBusy(false);
                            }
                          }}
                          style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', background: 'linear-gradient(135deg, #315f95 0%, #284f7d 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: forgotBusy ? 'wait' : 'pointer' }}
                        >
                          {forgotBusy ? 'Updating…' : 'Update Password'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setForgotOpen(false)}
                      style={{ marginTop: 12, width: '100%', border: '1px solid #d7e0e8', borderRadius: 14, padding: '11px 16px', background: '#fff', color: '#5b6b79', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
        <></>
        )}

        {authError ? (
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#fff5f5',
              color: '#a61b1b',
              border: '1px solid #fecaca',
              padding: '14px 16px',
            }}
          >
            <AlertCircle size={18} />
            <span>{authError}</span>
          </div>
        ) : null}

        {sessionUser ? (
        <>
        {mainTab === 'Standings' ? (
          <section
            style={{
              marginTop: isMobile ? 12 : 24,
              display: 'flex',
              overflowX: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 0,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overflowY: 'hidden',
                width: '100%',
                paddingBottom: 2,
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'none',
                touchAction: 'pan-x',
                borderBottom: '1px solid #d7e0e8',
              }}
            >
              {TOURNAMENTS.map((item, idx) => {
                const active = item.id === selectedTournament;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedTournament(item.id); setLeaderboardSearch(''); setLeaderboardViewMode('picked'); setFullLeaderboardRows(null); setSelectedLeaderboardPlayerId(null); setLeaderboardSortMode('default'); setLeaderboardPickedSort('default'); setShowCutInfo(false); setFeedRefreshNonce((v) => v + 1); void refreshCurrentSession(); }}
                    style={{
                      border: active ? '1px solid #d7e0e8' : '1px solid rgba(0,0,0,0.1)',
                      borderBottom: active ? '1px solid #fff' : '1px solid rgba(0,0,0,0.1)',
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#1f2f42' : '#46bfd1',
                      borderRadius: '10px 10px 0 0',
                      padding: isMobile ? '6px 8px 5px' : '10px 12px 9px',
                      width: isMobile ? 92 : TOURNAMENT_CARD_WIDTH,
                      height: isMobile ? 42 : TOURNAMENT_CARD_HEIGHT,
                      boxSizing: 'border-box',
                      flex: '0 0 auto',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: active ? 500 : 400,
                      lineHeight: 1.1,
                      boxShadow: 'none',
                      marginBottom: -1,
                      marginLeft: idx === 0 ? 0 : -1,
                      position: 'relative',
                      zIndex: active ? 1 : 0,
                    }}
                  >
                    {TOURNAMENT_TAB_LOGOS[item.id] ? (
                      <img
                        src={TOURNAMENT_TAB_LOGOS[item.id]}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          width: '100%',
                          height: isMobile ? (item.id === 'masters' ? 40 : item.id === 'pga' || item.id === 'players' ? 36 : 28) : (TOURNAMENT_TAB_LOGO_HEIGHTS[item.id] ?? 40),
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span>{item.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#fff5f5',
              color: '#a61b1b',
              border: '1px solid #fecaca',
              padding: '14px 16px',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {mainTab === 'Standings' && (
          <main
            style={{
              marginTop: isMobile ? 8 : 24,
              display: 'grid',
              gridTemplateColumns: (isMobile || showFutureTournamentView)
                ? 'minmax(0, 1fr)'
                : showFinalTournamentView
                ? 'minmax(0, 1.7fr) minmax(360px, 0.9fr)'
                : 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
              gap: 20,
            }}
          >
            <section
              ref={standingsColRef}
              style={{
                background: (selectedTournament === 'open' || selectedTournament === 'players') && !showFutureTournamentView ? '#F4BC41' : '#fff',
                borderRadius: 20,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                alignSelf: 'start',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: isMobile ? 'flex-start' : 'center' }}>
                <div>
                  {selectedTournament === 'players' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 21 : (showLivePayoutStrip ? 25 : 30), fontWeight: 800, color: '#0f1720' }}>
                        The Players Championship
                      </h2>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                          <button
                            onClick={() => setShowCutInfo((v) => !v)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 15, fontWeight: 700, color: '#2f5f96', touchAction: 'manipulation' }}
                          >
                            Projected Cut: {feed.projectedCut}
                            <span style={{ fontSize: isMobile ? 10 : 12, opacity: 0.65 }}>ⓘ</span>
                          </button>
                          {showCutInfo && (
                            <>
                              <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                                {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'masters' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 21 : (showLivePayoutStrip ? 25 : 30), fontWeight: 800, color: '#0f1720' }}>
                        The Masters Tournament
                      </h2>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                          <button
                            onClick={() => setShowCutInfo((v) => !v)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 15, fontWeight: 700, color: '#2f5f96', touchAction: 'manipulation' }}
                          >
                            Projected Cut: {feed.projectedCut}
                            <span style={{ fontSize: isMobile ? 10 : 12, opacity: 0.65 }}>ⓘ</span>
                          </button>
                          {showCutInfo && (
                            <>
                              <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                                {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'pga' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 21 : (showLivePayoutStrip ? 25 : 30), fontWeight: 800, color: '#0f1720' }}>
                        The PGA Championship
                      </h2>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                          <button
                            onClick={() => setShowCutInfo((v) => !v)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 15, fontWeight: 700, color: '#2f5f96', touchAction: 'manipulation' }}
                          >
                            Projected Cut: {feed.projectedCut}
                            <span style={{ fontSize: isMobile ? 10 : 12, opacity: 0.65 }}>ⓘ</span>
                          </button>
                          {showCutInfo && (
                            <>
                              <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                                {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'us-open' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : (showLivePayoutStrip ? 25 : 30), fontWeight: 800, color: '#0f1720' }}>
                        U.S. Open Championship
                      </h2>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                          <button
                            onClick={() => setShowCutInfo((v) => !v)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 15, fontWeight: 700, color: '#2f5f96', touchAction: 'manipulation' }}
                          >
                            Projected Cut: {feed.projectedCut}
                            <span style={{ fontSize: isMobile ? 10 : 12, opacity: 0.65 }}>ⓘ</span>
                          </button>
                          {showCutInfo && (
                            <>
                              <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                                {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'open' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : (showLivePayoutStrip ? 25 : 30), fontWeight: 800, color: '#0f1720' }}>
                        The Open Championship
                      </h2>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                          <button
                            onClick={() => setShowCutInfo((v) => !v)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 15, fontWeight: 700, color: '#2f5f96', touchAction: 'manipulation' }}
                          >
                            Projected Cut: {feed.projectedCut}
                            <span style={{ fontSize: isMobile ? 10 : 12, opacity: 0.65 }}>ⓘ</span>
                          </button>
                          {showCutInfo && (
                            <>
                              <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                                {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : TOURNAMENT_HEADING_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_HEADING_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          display: 'block',
                          width: 'min(100%, 640px)',
                          height: 72,
                          objectFit: 'contain',
                          objectPosition: 'left center',
                        }}
                      />
                  ) : (
                    <h2 style={{ margin: 0, fontSize: 26, color: '#0f1720' }}>
                      {showFinalTournamentView ? tournament.name : `${tournament.name} Pool Standings`}
                    </h2>
                  )}
                </div>
                {showLivePayoutStrip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isMobile ? '4px 9px' : '6px 10px', fontSize: isMobile ? 11 : 13, fontWeight: 800, color: '#fff' }}>
                        1st: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.first)}</span>
                      </div>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isMobile ? '4px 9px' : '6px 10px', fontSize: isMobile ? 11 : 13, fontWeight: 800, color: '#fff' }}>
                        2nd: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.second)}</span>
                      </div>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isMobile ? '4px 9px' : '6px 10px', fontSize: isMobile ? 11 : 13, fontWeight: 800, color: '#fff' }}>
                        3rd: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.third)}</span>
                      </div>
                    </div>
                    {!showFinalTournamentView && (isMobile ? (
                      <div style={{ fontSize: 11, textAlign: 'right' }}>
                        <span style={{ color: '#0f1720', fontWeight: 700 }}>Entry Fee: $30</span>{' '}
                        <a
                          href="venmo://paycharge?txn=pay&recipients=claytont743&amount=30&note=Golf%20Majors%20Pool"
                          style={{ color: '#3d95ce', textDecoration: 'underline', fontWeight: 700 }}
                        >
                          (pay here)
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#8fa0b0', textAlign: 'right', marginTop: 2 }}>
                        <strong style={{ color: '#0f1720' }}>Entry Fee:</strong> <span style={{ color: '#5b6b79' }}>$30</span>{'   '}
                        <strong style={{ color: '#0f1720' }}>Venmo:</strong> <span style={{ color: '#5b6b79' }}>@claytont743</span>
                      </div>
                    ))}
                  </div>
                ) : !showFutureTournamentView && !showFinalTournamentView ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5b6b79', fontSize: 14 }}>
                    <RefreshCw size={15} />
                    <span>
                      {isLoading
                        ? 'Refreshing live scores...'
                        : formatRefresh(feed?.fetchedAt ?? null)}
                    </span>
                  </div>
                ) : null}
              </div>

              {!showLivePayoutStrip && !showFinalTournamentView && picksOpenForTournament ? (
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    color: '#5b6b79',
                    fontSize: 14,
                  }}
                >
                  <span>
                    <strong style={{ color: '#0f1720' }}>Entry Fee:</strong> $30
                  </span>
                  <span>
                    <strong style={{ color: '#0f1720' }}>Venmo:</strong>{' '}
                    {isMobile ? (
                      <>
                        <span style={{ color: '#5b6b79' }}>@claytont743</span>{' '}
                        <a
                          href="venmo://paycharge?txn=pay&recipients=claytont743&amount=30&note=Golf%20Majors%20Pool"
                          style={{ color: '#3d95ce', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          (pay here)
                        </a>
                      </>
                    ) : '@claytont743'}
                  </span>
                </div>
              ) : null}

              {showFutureTournamentView ? (
                <div
                  style={{
                    marginTop: isMobile ? 14 : 28,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(180px, 240px) minmax(0, 1fr)',
                    gap: isMobile ? 14 : 28,
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: isMobile ? 160 : 180,
                    }}
                  >
                    {TOURNAMENT_CARD_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_CARD_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: isMobile ? 170 : 180,
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ color: '#0f1720', fontSize: isMobile ? 14 : 17, lineHeight: 1.55 }}>
                    <div style={{ fontSize: isMobile ? 15 : 20 }}>
                      {selectedTournament === 'pga'
                        ? 'The PGA Championship'
                        : selectedTournament === 'us-open'
                          ? 'The U.S. Open'
                          : selectedTournament === 'open'
                            ? 'The Open Championship'
                          : tournament.name}{' '}
                      begins on{' '}
                      {tournamentStartLabel}.
                    </div>
                    <div style={{ marginTop: 14 }}>
                      {picksOpenForTournament
                        ? 'The field has been finalized and picks are now open in the pool. Build your lineup before the first tee time on Thursday.'
                        : 'Picks can not be entered until the tournament field has been finalized and entered in our system (usually Monday morning the week of the tournament).'}
                    </div>

                    {picksOpenForTournament && selectedTournament === entriesTournamentId && sessionUser ? (
                      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <button
                          onClick={openMyEntriesEditor}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: isMobile ? '10px 16px' : '11px 18px',
                            background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 900,
                            cursor: 'pointer',
                            boxShadow: '0 14px 28px rgba(63, 115, 173, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 14} />
                          {hasSubmittedRoster ? 'Edit Picks' : 'Make Picks'}
                        </button>
                        <div style={{ color: '#5b6b79', fontSize: isMobile ? 14 : 19, fontWeight: 600 }}>
                          Members with submitted picks:{' '}
                          <span style={{ color: '#0f1720', fontWeight: 900 }}>{submittedEntries.length}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : showFinalTournamentView ? (
                <div style={{ marginTop: isMobile ? 14 : 28, overflowX: 'auto' }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Rank</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>Entry</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Roster Points</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>{isMobile ? 'Holes Rem' : 'Holes Remaining'}</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Tiebreak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          data-entry-id={entry.id}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                          }}
                          style={{
                            borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe'
                                : (selectedTournament === 'open' || selectedTournament === 'players') ? '#F4BC41' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 12px 10px 8px', fontSize: isMobile ? 12 : 13, textAlign: 'center' }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px' }}>
                            <div
                              style={{
                                fontSize: isMobile ? 13 : 14,
                                color: '#0f1720',
                                textAlign: 'left',
                              }}
                            >
                              {entry.name}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 8px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>{entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: isMobile ? 14 : 28, overflowX: 'auto' }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Rank</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>Entry</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Roster Points</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>{isMobile ? 'Holes Rem' : 'Holes Remaining'}</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Tiebreak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          data-entry-id={entry.id}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                          }}
                          style={{
                            borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe'
                                : (selectedTournament === 'open' || selectedTournament === 'players') ? '#F4BC41' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 12px 10px 8px', fontSize: isMobile ? 12 : 13, textAlign: 'center' }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px' }}>
                            <div style={{ fontSize: isMobile ? 13 : 14, color: '#0f1720', textAlign: 'left' }}>
                              {entry.name}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 8px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>{entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
            )}
            </section>

            <aside style={{ display: showFutureTournamentView ? 'none' : 'grid', gap: 20, alignSelf: isMobile ? undefined : 'start' }}>
              {showLivePayoutStrip ? (
                <section
                  ref={isMobile ? undefined : leaderboardColRef}
                  style={{
                    background: (selectedTournament === 'open' || selectedTournament === 'players') && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    borderRadius: 20,
                    padding: isMobile ? 14 : 22,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                    ...(isMobile ? {} : { display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const }),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    {tournament.id === 'pga' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 4 : 6, width: '100%' }}>
                        <img src="/pga-tab-logo.png" alt="PGA" style={{ height: isMobile ? 50 : 58, objectFit: 'contain', flexShrink: 0, margin: isMobile ? '-11px 0' : '-14px 0' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1 }}>Leaderboard</span>
                      </div>
                    ) : tournament.id === 'masters' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: isMobile ? 6 : 10, width: '100%' }}>
                        <img src="/masters-tab-logo.png" alt="Masters" style={{ height: isMobile ? 38 : 46, objectFit: 'contain', flexShrink: 0, marginTop: isMobile ? '-6px' : '-8px' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#2c6449', lineHeight: 1 }}>Leaderboard</span>
                      </div>
                    ) : tournament.id === 'players' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 6 : 10, width: '100%', marginTop: isMobile ? -36 : 0, marginBottom: isMobile ? -36 : 0 }}>
                        <img src="/tpc.webp" alt="The Players" style={{ height: isMobile ? 106 : 116, objectFit: 'contain', flexShrink: 0, margin: isMobile ? '0' : '-34px 0' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, marginTop: isMobile ? '6px' : '0' }}>Leaderboard</span>
                      </div>
                    ) : (
                      <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 22, color: '#0f1720', textAlign: 'center', fontWeight: 900, width: '100%' }}>{TOURNAMENT_LEADERBOARD_HEADER[tournament.id] ?? `${tournament.name} Leaderboard`}</h3>
                    )}
                  </div>

                  <div style={{ marginTop: isMobile ? 8 : 16, position: 'relative', marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Search player..."
                      value={leaderboardSearch}
                      onChange={(e) => {
                        const el = e.currentTarget as HTMLInputElement;
                        const savedY = window.scrollY;
                        setLeaderboardSearch(e.target.value);
                        if (isMobile) {
                          requestAnimationFrame(() => requestAnimationFrame(() => {
                            window.scroll(0, savedY);
                            const vv = window.visualViewport;
                            if (!vv) return;
                            const rect = el.getBoundingClientRect();
                            if (rect.bottom > vv.height - 20) {
                              window.scroll(0, savedY + rect.bottom - vv.height + 40);
                            }
                          }));
                        }
                      }}
                      onFocus={(e) => {
                        if (!isMobile) return;
                        const el = e.currentTarget;
                        setTimeout(() => {
                          const vv = window.visualViewport;
                          if (!vv) return;
                          const rect = el.getBoundingClientRect();
                          if (rect.bottom > vv.height - 20) {
                            window.scrollBy({ top: rect.bottom - vv.height + 40, behavior: 'smooth' });
                          }
                        }, 350);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: isMobile ? `4px ${leaderboardSearch ? 32 : 10}px 4px 10px` : `6px ${leaderboardSearch ? 32 : 12}px 6px 12px`,
                        fontSize: isMobile ? 16 : 13,
                        border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3',
                        borderRadius: 8,
                        outline: 'none',
                        color: '#0f1720',
                        background: '#fff',
                      }}
                    />
                    {leaderboardSearch && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setLeaderboardSearch(''); }}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#9ca3af',
                          border: 'none',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          lineHeight: 1,
                          touchAction: 'manipulation',
                        }}
                        aria-label="Clear search"
                      >
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                      </button>
                    )}
                  </div>
                  {(() => {
                    const tColor = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                    return (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {(['picked', 'full'] as const).map((mode) => {
                          const isActive = leaderboardViewMode === mode;
                          const label = mode === 'picked' ? 'Picked Only' : 'Full Leaderboard';
                          return (
                            <button
                              key={mode}
                              onClick={async (e) => {
                                (e.currentTarget as HTMLButtonElement).blur();
                                if (mode === 'full' && !fullLeaderboardRows) {
                                  try {
                                    const data = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}&fullField=true`, { cache: 'no-store' });
                                    setFullLeaderboardRows(data.fullLeaderboard ?? []);
                                  } catch { /* keep existing view */ }
                                }
                                setLeaderboardSortMode('default');
                                setLeaderboardPickedSort('default');
                                setLeaderboardViewMode(mode);
                              }}
                              style={{
                                flex: 1,
                                padding: isMobile ? '4px 6px' : '7px 12px',
                                fontSize: isMobile ? 12 : 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                border: `1.5px solid ${tColor}`,
                                background: isActive ? tColor : (selectedTournament === 'open' ? '#F4BC41' : '#fff'),
                                color: isActive ? '#fff' : tColor,
                                cursor: 'pointer',
                                transition: 'background 0.15s, color 0.15s',
                                touchAction: 'manipulation',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div style={{ overflowX: 'auto', overflowY: 'auto', ...(isMobile ? {} : { flex: 1, minHeight: 0 }) }}>
                    <div data-leaderboard-table="true" style={{ borderRadius: 10, overflow: isMobile ? 'auto' : 'hidden', maxHeight: isMobile ? 726 : undefined, WebkitOverflowScrolling: isMobile ? 'touch' : undefined, border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' } as React.CSSProperties}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 12 }}>
                      <thead>
                        {(() => {
                          const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                          const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: hBg };
                          return (
                            <tr style={{ background: hBg, color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Pos.</th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Player</th>
                              <th
                                onClick={() => { setLeaderboardPickedSort('default'); setLeaderboardSortMode((m) => m === 'default' ? 'round-desc' : m === 'round-desc' ? 'round-asc' : 'default'); }}
                                style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', ...stickyTh }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  {leaderboardSortMode === 'default' ? 'Total' : `Rnd ${feed?.currentRound ?? 1}`}
                                  {leaderboardSortMode === 'round-desc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▼</span>}
                                  {leaderboardSortMode === 'round-asc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▲</span>}
                                </span>
                              </th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Thru</th>
                              <th
                                onClick={() => leaderboardViewMode === 'picked' && (() => { setLeaderboardSortMode('default'); setLeaderboardPickedSort((m) => m === 'default' ? 'desc' : m === 'desc' ? 'asc' : 'default'); })()}
                                style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', cursor: leaderboardViewMode === 'picked' ? 'pointer' : 'default', userSelect: leaderboardViewMode === 'picked' ? 'none' : undefined, ...stickyTh }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  Picked
                                  {leaderboardViewMode === 'picked' && leaderboardPickedSort === 'desc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▼</span>}
                                  {leaderboardViewMode === 'picked' && leaderboardPickedSort === 'asc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▲</span>}
                                </span>
                              </th>
                            </tr>
                          );
                        })()}
                      </thead>
                      <tbody>
                        {leaderboardViewMode === 'full'
                          ? (() => {
                              const filteredFullRaw = (fullLeaderboardRows ?? []).filter((player) => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()));
                              const CUT_SCORE_SET_FL = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                              const parseCutScore = (s?: string) => { if (!s) return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseRndScoreFL = (s: string | null | undefined) => { if (!s || s === '--') return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseTeeTimeMinFL = (t: string | null | undefined) => { if (!t) return Infinity; const m = t.match(/(\d{1,2}):(\d{2}):/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Infinity; };
                              const filteredFull = leaderboardSortMode !== 'default'
                                ? [...filteredFullRaw].filter((p) => !CUT_SCORE_SET_FL.has(p.score.toUpperCase())).sort((a, b) => {
                                    const aS = parseRndScoreFL(a.currentRoundScore);
                                    const bS = parseRndScoreFL(b.currentRoundScore);
                                    if (aS !== bS) return leaderboardSortMode === 'round-desc' ? aS - bS : bS - aS;
                                    if (aS === Infinity) { const aT = parseTeeTimeMinFL(a.teeTime); const bT = parseTeeTimeMinFL(b.teeTime); if (aT !== bT) return aT - bT; }
                                    return a.name.localeCompare(b.name);
                                  })
                                : [
                                    ...filteredFullRaw.filter((p) => !CUT_SCORE_SET_FL.has(p.score.toUpperCase())),
                                    ...filteredFullRaw.filter((p) => CUT_SCORE_SET_FL.has(p.score.toUpperCase())).sort((a, b) => parseCutScore(a.originalScore) - parseCutScore(b.originalScore)),
                                  ];
                              const espnRoundFL = feed?.currentRound ?? 1;
                              const projCutNum = showProjectedCut && feed?.projectedCut && leaderboardSortMode === 'default' && espnRoundFL <= 2
                                ? (feed.projectedCut === 'E' ? 0 : parseFloat(feed.projectedCut) || 0)
                                : null;
                              const cutLineIdx = projCutNum !== null
                                ? filteredFull.reduce((last, p, i) => {
                                    const s = p.score.toUpperCase();
                                    if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'MC') return last;
                                    const n = s === 'E' ? 0 : parseFloat(p.score);
                                    return !isNaN(n) && n <= projCutNum ? i : last;
                                  }, -1)
                                : -1;
                              const derivedCutScoreFL = espnRoundFL >= 3 ? (() => {
                                const scores = (fullLeaderboardRows ?? []).filter(p => p.score === 'CUT' && p.originalScore).map(p => p.originalScore === 'E' ? 0 : parseFloat(p.originalScore!)).filter(n => !isNaN(n));
                                if (!scores.length) return null;
                                const cutLine = Math.min(...scores) - 1;
                                return cutLine === 0 ? 'E' : cutLine > 0 ? `+${cutLine}` : String(cutLine);
                              })() : null;
                              const effectiveCutScoreFL = feed?.projectedCut ?? derivedCutScoreFL;
                              const r34CutLineFL = leaderboardSortMode === 'default' && espnRoundFL >= 3 && effectiveCutScoreFL
                                ? filteredFull.reduce((last, p, i) => CUT_SCORE_SET_FL.has(p.score.toUpperCase()) ? last : i, -1)
                                : -1;
                              return filteredFull.map((player, rowIndex) => {
                                const timesPicked = player.poolPlayerId !== null
                                  ? standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === player.poolPlayerId).length, 0)
                                  : 0;
                                const activePlayer = player.poolPlayerId !== null && selectedLeaderboardPlayerId === player.poolPlayerId;
                                const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                const displayScore = showProjectedCut && isCutStatus && player.originalScore ? player.originalScore : player.score;
                                const displayScoreNum = parseFloat(displayScore);
                                const displayIsUnderPar = !isNaN(displayScoreNum) && displayScoreNum < 0;
                                const displayIsCut = displayScore === 'CUT' || displayScore === 'MDF' || displayScore === 'WD' || displayScore === 'DQ';
                                const colVal = leaderboardSortMode !== 'default' ? (player.currentRoundScore ?? '--') : displayScore;
                                const colNum = parseFloat(colVal);
                                const colUnderPar = !isNaN(colNum) && colNum < 0;
                                const colIsCut = displayIsCut && leaderboardSortMode === 'default';
                                const useRedBadge = (selectedTournament === 'players' || selectedTournament === 'open') && colUnderPar;
                                const useNavyBadge = (selectedTournament === 'players' || selectedTournament === 'open') && !colUnderPar && !colIsCut && colVal !== '--' && (colVal === 'E' || (!isNaN(colNum) && colNum > 0));
                                const rowBg = activePlayer ? (selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe') : (selectedTournament === 'open' || selectedTournament === 'players') ? '#F4BC41' : '#ffffff';
                                return (
                                  <Fragment key={player.playerId}>
                                    <tr
                                      onClick={() => player.poolPlayerId !== null && setSelectedLeaderboardPlayerId(activePlayer ? null : player.poolPlayerId)}
                                      style={{ background: rowBg, borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef', cursor: player.poolPlayerId !== null ? 'pointer' : 'default' }}
                                    >
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{formatLeaderboardPosition(player.position)}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', fontWeight: activePlayer ? 800 : 500, color: '#0f1720' }}>{player.name}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: colIsCut ? 600 : 700, color: colUnderPar && !useRedBadge ? '#dc2626' : (useNavyBadge ? '#0f1720' : (colVal === 'E' ? '#16a34a' : (colIsCut ? '#374151' : '#0f1720'))) }}>{player.score === 'CUT' && player.originalScore && leaderboardSortMode === 'default' ? <span onClick={(e) => handleCutClick(String(player.playerId), e)} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 34, textAlign: 'center', WebkitTapHighlightColor: 'transparent', userSelect: 'none', touchAction: 'manipulation' }}>{expandedCutIds.has(String(player.playerId)) ? player.originalScore : 'CUT'}</span> : useRedBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : useNavyBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a5f', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : colVal}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: '#374151' }}>{(() => {
                                        const isGoldTheme = selectedTournament === 'players' || selectedTournament === 'open';
                                        const thruDisplay = (() => {
                                          const isLive = selectedTournamentStatus?.label === 'IN PROGRESS';
                                          if (isLive && !isCutStatus && player.thru === '--' && player.teeTime) {
                                            return formatTeeTime(player.teeTime);
                                          }
                                          const clientRound = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                                          const espnRound = feed?.currentRound ?? 1;
                                          if (isLive && !isCutStatus && player.thru === 'F' && clientRound > espnRound) {
                                            return player.teeTime ? formatTeeTime(player.teeTime) : '--';
                                          }
                                          const thruVal = player.thru;
                                          return player.backNineStart && thruVal !== '--' && thruVal !== 'F'
                                            ? <span style={{ position: 'relative' }}>{thruVal}<sup style={{ position: 'absolute', left: '100%', top: '-0.3em', fontSize: '0.65em', lineHeight: 1 }}>*</sup></span>
                                            : thruVal;
                                        })();
                                        return isGoldTheme ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 24, fontWeight: 600 }}>{thruDisplay}</span> : thruDisplay;
                                      })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: timesPicked > 0 ? '#374151' : '#b0bec5' }}>{(selectedTournament === 'players' || selectedTournament === 'open') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 24, fontWeight: 600 }}>{timesPicked > 0 ? timesPicked : '–'}</span> : timesPicked > 0 ? timesPicked : '–'}</td>
                                    </tr>
                                    {rowIndex === cutLineIdx && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={5} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PROJECTED CUT</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {rowIndex === r34CutLineFL && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={5} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE {effectiveCutScoreFL}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()
                          : (() => {
                              const filteredPickedRaw = eventLeaderboardRows.filter((player) => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()));
                              const CUT_SCORE_SET_PO = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                              const parseCutScorePO = (s?: string) => { if (!s) return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseRndScorePO = (s: string | null | undefined) => { if (!s || s === '--') return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseTeeTimeMinPO = (t: string | null | undefined) => { if (!t) return Infinity; const m = t.match(/(\d{1,2}):(\d{2}):/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Infinity; };
                              const pickedCountMap = new Map<number, number>();
                              for (const entry of standings) {
                                for (const golfer of entry.golfers) {
                                  pickedCountMap.set(golfer.id, (pickedCountMap.get(golfer.id) ?? 0) + 1);
                                }
                              }
                              const filteredPicked = leaderboardPickedSort !== 'default'
                                ? [...filteredPickedRaw].sort((a, b) => {
                                    const aP = pickedCountMap.get(a.id) ?? 0;
                                    const bP = pickedCountMap.get(b.id) ?? 0;
                                    if (aP !== bP) return leaderboardPickedSort === 'desc' ? bP - aP : aP - bP;
                                    return a.name.localeCompare(b.name);
                                  })
                                : leaderboardSortMode !== 'default'
                                ? [...filteredPickedRaw].filter((p) => !CUT_SCORE_SET_PO.has(p.score.toUpperCase())).sort((a, b) => {
                                    const aS = parseRndScorePO(a.currentRoundScore);
                                    const bS = parseRndScorePO(b.currentRoundScore);
                                    if (aS !== bS) return leaderboardSortMode === 'round-desc' ? aS - bS : bS - aS;
                                    if (aS === Infinity) { const aT = parseTeeTimeMinPO(a.teeTime); const bT = parseTeeTimeMinPO(b.teeTime); if (aT !== bT) return aT - bT; }
                                    return a.name.localeCompare(b.name);
                                  })
                                : [
                                    ...filteredPickedRaw.filter((p) => !CUT_SCORE_SET_PO.has(p.score.toUpperCase())),
                                    ...filteredPickedRaw.filter((p) => CUT_SCORE_SET_PO.has(p.score.toUpperCase())).sort((a, b) => parseCutScorePO(a.originalScore) - parseCutScorePO(b.originalScore)),
                                  ];
                              const espnRoundPO = feed?.currentRound ?? 1;
                              const projCutNum = showProjectedCut && feed?.projectedCut && leaderboardSortMode === 'default' && leaderboardPickedSort === 'default' && espnRoundPO <= 2
                                ? (feed.projectedCut === 'E' ? 0 : parseFloat(feed.projectedCut) || 0)
                                : null;
                              const cutLineIdx = projCutNum !== null
                                ? filteredPicked.reduce((last, p, i) => {
                                    const s = p.score.toUpperCase();
                                    if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'MC') return last;
                                    const n = s === 'E' ? 0 : parseFloat(p.score);
                                    return !isNaN(n) && n <= projCutNum ? i : last;
                                  }, -1)
                                : -1;
                              const derivedCutScorePO = espnRoundPO >= 3 ? (() => {
                                const cutSource: Array<{ score: string; originalScore?: string }> = fullLeaderboardRows?.length ? fullLeaderboardRows : (feed?.players ?? []);
                                const scores = cutSource.filter(p => p.score === 'CUT' && p.originalScore).map(p => p.originalScore === 'E' ? 0 : parseFloat(p.originalScore!)).filter(n => !isNaN(n));
                                if (!scores.length) return null;
                                const cutLine = Math.min(...scores) - 1;
                                return cutLine === 0 ? 'E' : cutLine > 0 ? `+${cutLine}` : String(cutLine);
                              })() : null;
                              const effectiveCutScorePO = feed?.projectedCut ?? derivedCutScorePO;
                              const r34CutLinePO = leaderboardSortMode === 'default' && leaderboardPickedSort === 'default' && espnRoundPO >= 3 && effectiveCutScorePO
                                ? filteredPicked.reduce((last, p, i) => CUT_SCORE_SET_PO.has(p.score.toUpperCase()) ? last : i, -1)
                                : -1;
                              return filteredPicked.map((player, rowIndex) => {
                                const timesPicked = pickedCountMap.get(player.id) ?? 0;
                                const activePlayer = selectedLeaderboardPlayerId === player.id;
                                const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                const displayScore = showProjectedCut && isCutStatus && player.originalScore ? player.originalScore : player.score;
                                const displayScoreNum = parseFloat(displayScore);
                                const displayIsUnderPar = !isNaN(displayScoreNum) && displayScoreNum < 0;
                                const displayIsCut = displayScore === 'CUT' || displayScore === 'MDF' || displayScore === 'WD' || displayScore === 'DQ';
                                const colVal = leaderboardSortMode !== 'default' ? (player.currentRoundScore ?? '--') : displayScore;
                                const colNum = parseFloat(colVal);
                                const colUnderPar = !isNaN(colNum) && colNum < 0;
                                const colIsCut = displayIsCut && leaderboardSortMode === 'default';
                                const useRedBadge = (selectedTournament === 'players' || selectedTournament === 'open') && colUnderPar;
                                const useNavyBadge = (selectedTournament === 'players' || selectedTournament === 'open') && !colUnderPar && !colIsCut && colVal !== '--' && (colVal === 'E' || (!isNaN(colNum) && colNum > 0));
                                const rowBg = activePlayer ? (selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe') : (selectedTournament === 'open' || selectedTournament === 'players') ? '#F4BC41' : '#ffffff';
                                return (
                                  <Fragment key={player.id}>
                                    <tr
                                      onClick={() => setSelectedLeaderboardPlayerId(activePlayer ? null : player.id)}
                                      style={{
                                        background: rowBg,
                                        borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{formatLeaderboardPosition(player.position)}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', fontWeight: activePlayer ? 800 : 500, color: '#0f1720' }}>{player.name}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: colIsCut ? 600 : 700, color: colUnderPar && !useRedBadge ? '#dc2626' : (useNavyBadge ? '#0f1720' : (colVal === 'E' ? '#16a34a' : (colIsCut ? '#374151' : '#0f1720'))) }}>{player.score === 'CUT' && player.originalScore && leaderboardSortMode === 'default' ? <span onClick={(e) => handleCutClick(String(player.id), e)} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 34, textAlign: 'center', WebkitTapHighlightColor: 'transparent', userSelect: 'none', touchAction: 'manipulation' }}>{expandedCutIds.has(String(player.id)) ? player.originalScore : 'CUT'}</span> : useRedBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : useNavyBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a5f', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : colVal}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: '#374151' }}>{(() => {
                                        const isGoldTheme = selectedTournament === 'players' || selectedTournament === 'open';
                                        const thruDisplay = (() => {
                                          const isLive = selectedTournamentStatus?.label === 'IN PROGRESS';
                                          const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                          if (isLive && !isCutStatus && player.thru === '--' && player.teeTime) {
                                            return formatTeeTime(player.teeTime);
                                          }
                                          const clientRound = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                                          const espnRound = feed?.currentRound ?? 1;
                                          if (isLive && !isCutStatus && player.thru === 'F' && clientRound > espnRound) {
                                            return player.teeTime ? formatTeeTime(player.teeTime) : '--';
                                          }
                                          const thruVal = player.thru;
                                          return player.backNineStart && thruVal !== '--' && thruVal !== 'F'
                                            ? <span style={{ position: 'relative' }}>{thruVal}<sup style={{ position: 'absolute', left: '100%', top: '-0.3em', fontSize: '0.65em', lineHeight: 1 }}>*</sup></span>
                                            : thruVal;
                                        })();
                                        return isGoldTheme ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 24, fontWeight: 600 }}>{thruDisplay}</span> : thruDisplay;
                                      })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: '#374151' }}>
                                        {(selectedTournament === 'players' || selectedTournament === 'open') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 24, fontWeight: 600 }}>{timesPicked}</span> : timesPicked}
                                      </td>
                                    </tr>
                                    {rowIndex === cutLineIdx && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={5} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PROJECTED CUT</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {rowIndex === r34CutLinePO && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={5} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE {effectiveCutScorePO}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </section>
              ) : null}

              {!showLivePayoutStrip ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                      My entry
                    </div>
                    <h3 style={{ margin: '6px 0 0', fontSize: 24 }}>{userLabel}</h3>
                    <div style={{ marginTop: 4, color: '#6b7b88', fontSize: 13 }}>
                      {sessionUser ? 'Saved to your account' : 'Guest mode until you sign in'}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 999,
                      background: locked ? '#fff1f2' : '#eaf2ff',
                      color: locked ? '#be123c' : '#2f5f96',
                      fontWeight: 800,
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    <Lock size={14} />
                    {locked ? 'Locked' : 'Editable'}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>{renderRosterCards('#fff')}</div>
                {renderBudgetCards('#f5f9fb', 'none')}

                {!sessionUser ? (
                  <div
                    style={{
                      marginTop: 14,
                      borderRadius: 14,
                      background: '#fff8e7',
                      color: '#9a6700',
                      padding: '12px 14px',
                    }}
                  >
                    Sign in or create an account above to save this lineup to the pool.
                  </div>
                ) : null}

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eef4ff',
                      color: '#2f5f96',
                      padding: '12px 14px',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <button
                  onClick={() => canSave && setShowRosterConfirm(true)}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: canSave ? 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)' : '#cbd5df',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {sessionUser ? 'Submit Roster' : 'Sign in to save'}
                </button>
              </section>
              ) : null}

              {!showLivePayoutStrip ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Trophy size={18} color="#2f5f96" />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Tracked golfers</div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {players.map((player) => {
                    const selected = selectedRoster.includes(player.id);
                    const disabled =
                      !selected &&
                      (locked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePlayer(player.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: selected ? '2px solid #3f73ad' : disabled ? '1px solid #d7dee6' : '1px solid #e6edf1',
                          background: selected ? '#eef4ff' : disabled ? '#f3f5f7' : '#fff',
                          padding: 14,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.58 : 1,
                        }}
                        disabled={disabled}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>{player.name}</div>
                            <div style={{ marginTop: 4, color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 13 }}>
                              OWGR {player.worldRank} | {player.odds}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
                            <div style={{ color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 12 }}>
                              ${player.salary.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
              ) : null}
            </aside>
          </main>
        )}

        {mainTab === 'My Entries' && (
          <main style={{ marginTop: isMobile ? 14 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            {!sessionUser ? (
              <div
                style={{
                  borderRadius: 18,
                  background: '#fff8e7',
                  color: '#9a6700',
                  border: '1px solid #f0d28a',
                  padding: isMobile ? '12px 14px' : '16px 18px',
                  fontSize: isMobile ? 13 : 15,
                }}
              >
                This tab is ready for saved entries, but you need to sign in first so the lineup belongs to your account.
              </div>
            ) : sessionUser && !myEntriesEditorOpen ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 20,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 26, color: '#0f1720' }}>Manage Entries</h2>
                <div style={{ marginTop: isMobile ? 6 : 18, color: '#0f1720', fontSize: isMobile ? 11 : 15, lineHeight: 1.45 }}>
                  {TOURNAMENT_ENTRIES_INTRO[entriesTournamentId] ?? `Make or edit your picks for ${entriesTournament.name} below.`} You can submit or modify your picks up until the first tee time of Round 1.
                </div>

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: isMobile ? 10 : 18,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eef4ff',
                      color: '#2f5f96',
                      padding: isMobile ? '8px 10px' : '12px 14px',
                      fontSize: isMobile ? 12 : 14,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: isMobile ? 10 : 24,
                    display: 'grid',
                    gridTemplateColumns: (isMobile && hasSubmittedRoster)
                      ? '1fr auto'
                      : isMobile
                        ? 'auto 1fr auto'
                        : 'minmax(220px, 1fr) minmax(320px, 420px) minmax(220px, 1fr)',
                    gap: isMobile ? '6px 8px' : 20,
                    alignItems: 'center',
                  }}
                >
                  {!(isMobile && hasSubmittedRoster) && (
                    <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720' }}>Entry</div>
                  )}
                  <div
                    style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'center', justifySelf: 'center' }}
                  >
                    {TOURNAMENT_PICKS_HEADER[entriesTournamentId] ?? `${entriesTournament.name} Picks`}
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'right' }}>Options</div>

                  {!(isMobile && hasSubmittedRoster) && (
                    <div style={{ fontSize: isMobile ? 12 : 18, color: '#0f1720', fontWeight: isMobile ? 600 : 400 }}>{userLabel}</div>
                  )}
                  <div style={{ display: 'grid', justifyItems: (isMobile && hasSubmittedRoster) ? 'stretch' : 'center' }}>
                    {hasSubmittedRoster ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
                        <div
                          style={{
                            borderRadius: 12,
                            border: '1px solid #dce6ee',
                            background: '#f8fbfd',
                            padding: isMobile ? '8px 10px' : '12px 14px',
                            display: 'grid',
                            gap: isMobile ? 6 : 10,
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 6 : 10 }}>
                            {savedRosterPlayers.map((player) => (
                              <span
                                key={player.id}
                                style={{
                                  borderRadius: 999,
                                  background: '#e8f3ff',
                                  color: '#2f5f96',
                                  padding: isMobile ? '4px 14px 4px 4px' : '6px 18px 6px 6px',
                                  fontSize: isMobile ? 15 : 17,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: isMobile ? 8 : 10,
                                }}
                              >
                                <img
                                  src={player.photoUrl ?? pgaPhoto(player.pgaTourId)}
                                  alt={player.name}
                                  style={{
                                    width: isMobile ? 40 : 44,
                                    height: isMobile ? 40 : 44,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    background: '#fff',
                                    mixBlendMode: 'multiply',
                                    flexShrink: 0,
                                  }}
                                />
                                {player.name.split(' ').slice(-1)[0]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={entriesLocked ? undefined : openMyEntriesEditor}
                          disabled={entriesLocked}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: isMobile ? '10px 16px' : '11px 18px',
                            background: entriesLocked ? '#b0bec5' : 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 900,
                            cursor: entriesLocked ? 'not-allowed' : 'pointer',
                            boxShadow: entriesLocked ? 'none' : '0 14px 28px rgba(63, 115, 173, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                            opacity: entriesLocked ? 0.7 : 1,
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 14} />
                          Edit Picks
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={entriesLocked ? undefined : openMyEntriesEditor}
                        disabled={entriesLocked}
                        style={{
                          border: 'none',
                          borderRadius: 12,
                          padding: isMobile ? '6px 10px' : '11px 18px',
                          background: entriesLocked ? '#b0bec5' : 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                          color: '#fff',
                          fontSize: isMobile ? 12 : 14,
                          fontWeight: 900,
                          cursor: entriesLocked ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          opacity: entriesLocked ? 0.7 : 1,
                        }}
                      >
                        <Pencil size={12} />
                        Make Picks
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', position: 'relative' }}>
                    {myEntriesMenuOpen ? (
                      <button
                        type="button"
                        aria-label="Close entry options"
                        onClick={() => setMyEntriesMenuOpen(false)}
                        style={{
                          position: 'fixed',
                          inset: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'default',
                          padding: 0,
                          margin: 0,
                          zIndex: 5,
                        }}
                      />
                    ) : null}
                    <button
                      onClick={() => setMyEntriesMenuOpen((current) => !current)}
                      style={{
                        border: '1px solid #d7e0e8',
                        borderRadius: 10,
                        width: isMobile ? 34 : 48,
                        height: isMobile ? 34 : 48,
                        background: '#fff',
                        color: '#0f1720',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={isMobile ? 14 : 18} />
                    </button>
                    {myEntriesMenuOpen ? (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: 56,
                          right: 0,
                          width: 240,
                          borderRadius: 16,
                          border: '1px solid #d7e0e8',
                          background: '#fff',
                          boxShadow: '0 18px 40px rgba(9, 34, 51, 0.14)',
                          padding: 8,
                          display: 'grid',
                          gap: 4,
                          zIndex: 10,
                        }}
                      >
                        <button
                          onClick={entriesLocked ? undefined : () => {
                            setMyEntriesMenuOpen(false);
                            openMyEntriesEditor();
                          }}
                          disabled={entriesLocked}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: entriesLocked ? '#9ba8b4' : '#0f1720',
                            fontSize: 15,
                            cursor: entriesLocked ? 'not-allowed' : 'pointer',
                            opacity: entriesLocked ? 0.6 : 1,
                          }}
                        >
                          <Pencil size={15} />
                          <span>{hasSubmittedRoster ? 'Edit Picks' : 'Make Picks'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            setMyEntriesDetailView('history');
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#0f1720',
                            fontSize: 15,
                            cursor: 'pointer',
                          }}
                        >
                          <History size={15} />
                          <span>View Pick History</span>
                        </button>
                        <button
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            setAccountDisplayName(sessionUser.displayName);
                            setMyEntriesDetailView('rename');
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#0f1720',
                            fontSize: 15,
                            cursor: 'pointer',
                          }}
                        >
                          <CircleUserRound size={15} />
                          <span>Rename Entry</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {myEntriesDetailView === 'history' ? (
                  <div
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      border: '1px solid #d7e0e8',
                      background: '#f8fbfd',
                      padding: 18,
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>Pick History</div>
                      <button
                        onClick={() => setMyEntriesDetailView('none')}
                        style={{
                          border: '1px solid #d7e0e8',
                          borderRadius: 12,
                          padding: '10px 14px',
                          background: '#fff',
                          color: '#0f1720',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {TOURNAMENTS.map((event) => {
                        const historyPlayers = (sessionUser.rosters[event.id] ?? []).map((id) => playersById[id]).filter(Boolean);
                        return (
                          <div
                            key={`history-${event.id}`}
                            style={{
                              borderRadius: 16,
                              border: '1px solid #dce6ee',
                              background: '#fff',
                              padding: 14,
                              display: 'grid',
                              gap: 10,
                            }}
                          >
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{PICK_HISTORY_NAMES[event.id] ?? event.name}</div>
                            {historyPlayers.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {historyPlayers.map((player) => (
                                  <span
                                    key={`history-player-${event.id}-${player.id}`}
                                    style={{
                                      borderRadius: 999,
                                      background: '#e8f3ff',
                                      color: '#2f5f96',
                                      padding: '5px 12px 5px 5px',
                                      fontSize: 13,
                                      fontWeight: 800,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <img
                                      src={player.photoUrl ?? pgaPhoto(player.pgaTourId)}
                                      alt={player.name}
                                      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#fff', mixBlendMode: 'multiply' }}
                                    />
                                    {player.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#6b7b88', fontSize: 14 }}>No submitted roster saved for this event yet.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {myEntriesDetailView === 'rename' ? (
                  <div
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      border: '1px solid #d7e0e8',
                      background: '#f8fbfd',
                      padding: 18,
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>Rename Entry</div>
                      <button
                        onClick={() => setMyEntriesDetailView('none')}
                        style={{
                          border: '1px solid #d7e0e8',
                          borderRadius: 12,
                          padding: '10px 14px',
                          background: '#fff',
                          color: '#0f1720',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <input
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                      placeholder="Display name"
                      style={{ ...fieldStyle(), maxWidth: 420 }}
                    />
                    <div>
                      <button
                        onClick={handleUpdateOwnDisplayName}
                        disabled={accountBusy}
                        style={{
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Entry Name
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : sessionUser && entriesPreFieldView ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 30, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(320px, 0.85fr)',
                    gap: 28,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 20 }}>
                    <section
                      style={{
                        borderRadius: 18,
                        border: '1px solid #dce6ee',
                        overflow: 'hidden',
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          padding: isMobile ? 12 : 22,
                          background: '#f3f6fa',
                          borderBottom: '1px solid #dce6ee',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 16,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: isMobile ? 16 : 26, lineHeight: 1.25, fontWeight: 900, color: '#0f1720' }}>
                            {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 8,
                              color: '#5b6b79',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? 13 : 18, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 12 : 16, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        <label
                          style={{
                            width: 340,
                            maxWidth: '100%',
                            borderRadius: 12,
                            border: '1px solid #d7e0e8',
                            background: '#fff',
                            padding: '0 18px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <Search size={18} color="#8a98a6" />
                          <input
                            value={entriesPlayerSearch}
                            onChange={(event) => setEntriesPlayerSearch(event.target.value)}
                            placeholder="Search"
                            style={{
                              border: 'none',
                              outline: 'none',
                              width: '100%',
                              fontSize: isMobile ? 16 : 15,
                              color: '#0f1720',
                              padding: '14px 0',
                              background: 'transparent',
                            }}
                          />
                          {entriesPlayerSearch && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEntriesPlayerSearch(''); }}
                              style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                              aria-label="Clear search"
                            >
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </label>
                      </div>

                      <div style={{ padding: 20, minHeight: 430 }}>
                        <div
                          style={{
                            borderRadius: 14,
                            background: '#f7f0da',
                            color: '#7a5a00',
                            padding: '18px 20px',
                            fontSize: isMobile ? 12 : 15,
                            lineHeight: 1.5,
                          }}
                        >
                          Picks can not be entered until the tournament field has been finalized and world golf
                          rankings have been updated for the week (usually by Monday morning, the week of the
                          tournament).
                        </div>
                      </div>
                    </section>
                  </div>

                  <aside style={{ display: 'grid', gap: 18 }}>
                    <div
                      style={{
                        borderRadius: 16,
                        border: '1px solid #dce6ee',
                        padding: '22px 26px',
                        background: '#fff',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 28 : 44, lineHeight: 1, fontWeight: 900, color: '#198754' }}>
                        ${SALARY_CAP.toLocaleString()}
                      </div>
                      <div style={{ marginTop: 12, color: '#0f1720', fontSize: isMobile ? 12 : 15 }}>
                        Avg Rem./Player: ${Math.round(SALARY_CAP / REQUIRED_GOLFERS).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ display: 'grid', gap: isMobile ? 16 : 14 }}>
                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => (
                        <div
                          key={`placeholder-slot-${index + 1}`}
                          style={{
                            borderRadius: 14,
                            border: '1px solid #d7e0e8',
                            background: '#fff',
                            padding: isMobile ? '16px 16px' : '16px 18px',
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 17 : 18, color: '#556572' }}>Golfer #{index + 1}</div>
                        </div>
                      ))}
                    </div>

                    <input
                      value={tieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setTieBreakInput(val);
                      }}
                      placeholder={`Enter tiebreak value* (Par = ${TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '?'})`}
                      inputMode="numeric"
                      maxLength={3}
                      style={{
                        ...fieldStyle(),
                      }}
                    />
                    <button
                      disabled
                      style={{
                        width: 170,
                        border: 'none',
                        borderRadius: 14,
                        padding: '14px 18px',
                        background: '#dfe5eb',
                        color: '#566675',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: 'not-allowed',
                      }}
                    >
                      Submit Roster
                    </button>
                    <div style={{ color: '#5b6b79', fontSize: 13, lineHeight: 1.65 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                      Use their total strokes, NOT score to par. Example: Enter 274 (NOT -14)
                    </div>
                  </aside>
                </div>
              </section>
            ) : sessionUser ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 30, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(320px, 0.8fr)',
                    gap: 22,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ border: '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
                      <div
                        style={{
                          padding: isMobile ? 12 : 22,
                          background: '#f7f9fb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: isMobile ? 'flex-start' : 'center',
                          flexWrap: 'wrap',
                          borderBottom: '1px solid #d7e0e8',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>
                            {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name}
                          </div>
                          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>
                            Tournament Field
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 8,
                              color: '#5b6b79',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        <label
                          style={{
                            minWidth: isMobile ? 140 : 280,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #d7e0e8',
                            borderRadius: 14,
                            background: '#fff',
                            padding: '0 14px',
                          }}
                        >
                          <Search size={18} color="#6b7b88" />
                          <input
                            value={entriesPlayerSearch}
                            onChange={(event) => setEntriesPlayerSearch(event.target.value)}
                            placeholder="Search"
                            style={{
                              border: 'none',
                              outline: 'none',
                              width: '100%',
                              padding: isMobile ? '10px 0' : '12px 0',
                              fontSize: isMobile ? 16 : 15,
                              background: 'transparent',
                              color: '#0f1720',
                            }}
                          />
                          {entriesPlayerSearch && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEntriesPlayerSearch(''); }}
                              style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                              aria-label="Clear search"
                            >
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </label>
                      </div>

                      <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: '1px solid #e6edf1', position: 'sticky', top: 0, background: '#f7f9fb', zIndex: 1 }}>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720', textAlign: 'center' }}>OWGR</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720' }}>Salary</div>
                          <div></div>
                        </div>
                        {filteredEntriesPlayers.map((player) => {
                          const disabled = entriesLocked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining;

                          return (
                            <div
                              key={player.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px',
                                padding: isMobile ? '11px 12px' : '15px 20px',
                                borderBottom: '1px solid #e6edf1',
                                alignItems: 'center',
                                opacity: disabled ? 0.45 : 1,
                                background: '#fff',
                              }}
                            >
                              <div style={{ fontSize: isMobile ? 13 : 17, color: '#0f1720', textAlign: 'center' }}>{player.worldRank}</div>
                              <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 600, color: '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>{player.name}</div>
                              <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, color: '#0f1720' }}>${player.salary.toLocaleString()}</div>
                              <button
                                onClick={() => togglePlayer(player.id)}
                                disabled={disabled}
                                style={{
                                  width: isMobile ? 34 : 42,
                                  height: isMobile ? 34 : 42,
                                  borderRadius: 10,
                                  border: '1px solid #d7dee6',
                                  background: '#fff',
                                  color: '#0f1720',
                                  fontSize: isMobile ? 20 : 24,
                                  fontWeight: 400,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ border: '1px solid #d7e0e8', borderRadius: isMobile ? 18 : 14, padding: isMobile ? 16 : '12px 18px', background: '#fff' }}>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 2, fontSize: isMobile ? 30 : 34, fontWeight: 900, color: '#1f8d4e' }}>${salaryRemaining.toLocaleString()}</div>
                      <div style={{ marginTop: isMobile ? 8 : 4, fontSize: isMobile ? 12 : 13, color: '#31424f' }}>
                        Avg Rem./Player: ${averageRemainingPerPlayer.toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                        const golfer = orderedRosterPlayers[index];
                        return (
                          <div
                            key={`entries-roster-slot-${index}`}
                            style={{
                              border: '1px solid #d7e0e8',
                              borderRadius: isMobile ? 14 : 14,
                              background: '#fff',
                              minHeight: isMobile ? 100 : undefined,
                              height: isMobile ? undefined : 96,
                              display: 'flex',
                              overflow: 'hidden',
                            }}
                          >
                              {golfer ? (
                                <>
                                  <div style={{ width: isMobile ? 90 : 88, flexShrink: 0, alignSelf: 'stretch', background: '#fff', overflow: 'hidden', position: 'relative' }}>
                                    <img
                                      src={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)}
                                      alt={golfer.name}
                                      className="roster-card-photo"
                                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                  </div>
                                  <div style={{ flex: 1, padding: isMobile ? '8px 14px' : '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                      <div style={{ fontSize: isMobile ? 18 : 19, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                                      <div style={{ marginTop: isMobile ? 3 : 2, fontSize: isMobile ? 15 : 15, color: '#607282' }}>
                                        Salary: <span style={{ fontWeight: 800, color: '#3f73ad' }}>${golfer.salary.toLocaleString()}</span>
                                      </div>
                                      <div style={{ marginTop: isMobile ? 2 : 1, fontSize: isMobile ? 14 : 13, color: '#607282' }}>
                                        World Rank: <span style={{ fontWeight: 700, color: '#0f1720' }}>{golfer.worldRank}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => togglePlayer(golfer.id)}
                                      style={{
                                        width: isMobile ? 34 : 30,
                                        height: isMobile ? 34 : 30,
                                        borderRadius: 8,
                                        border: '1px solid #d7dee6',
                                        background: '#fff',
                                        color: '#0f1720',
                                        fontSize: isMobile ? 20 : 18,
                                        fontWeight: 400,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      −
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ flex: 1, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14 }}>
                                  <div style={{ width: isMobile ? 62 : 72, height: isMobile ? 62 : 72, borderRadius: 6, background: '#e8eef4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CircleUserRound size={isMobile ? 32 : 40} color="#a0b0be" />
                                  </div>
                                  <div style={{ fontSize: isMobile ? 16 : 18, color: '#50616f', fontWeight: 600 }}>Golfer #{index + 1}</div>
                                </div>
                              )}
                          </div>
                        );
                      })}

                      <input
                        value={tieBreakInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setTieBreakInput(val);
                        }}
                        placeholder={`Enter tiebreak value* (Par = ${TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '?'})`}
                        inputMode="numeric"
                        maxLength={3}
                        style={{ ...fieldStyle(), marginTop: 4 }}
                      />

                      {saveMessage ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 14,
                            background: '#eef4ff',
                            color: '#2f5f96',
                            padding: '12px 14px',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>{saveMessage}</span>
                        </div>
                      ) : null}

                      <button
                        onClick={() => canSave && setShowRosterConfirm(true)}
                        style={{
                          width: 'fit-content',
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: canSave ? 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)' : '#cbd5df',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: canSave ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        Submit Roster
                      </button>
                      <div style={{ color: '#5b6b79', fontSize: 13, lineHeight: 1.65 }}>
                        * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                        Use their total strokes, NOT score to par. Example: Enter 274 (NOT -14)
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </main>
        )}

        {mainTab === 'Details' && (
          <main style={{ marginTop: isMobile ? 12 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            <section
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 700, color: '#0f1720' }}>
                <span style={{ marginRight: 6 }}>🏌️</span>
                Roster &amp; Entry Details
              </div>
              <div style={{ marginTop: isMobile ? 8 : 14, display: 'grid', gap: isMobile ? 8 : 18, color: '#0f1720', lineHeight: 1.5, fontSize: isMobile ? 12 : 15 }}>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  For each major tournament, and The Players Championship, members select <strong>6 golfers</strong>.
                  Each golfer will have a salary assigned to them based strictly on their odds to win the tournament.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  Participants will be assigned a fixed salary cap of <strong>$50,000</strong> they must stay under in
                  order to create their 6-player roster. These 6 golfers make up their player roster for that specific
                  tournament.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  Golfers <strong>CAN be picked more than once per season.</strong> Points are awarded based on the
                  players hole by hole performance, as well as their tournament standings. Cut players receive
                  <strong> -10 points.</strong>
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  The scores of all <strong>6 golfers</strong> on your roster count towards your score.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  You&apos;ll enter what you think the winning score for the champion will be (i.e. 276) when entering your
                  picks, to serve as a tiebreaker value.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  <strong>1st, 2nd and 3rd places pay out</strong>, and amounts vary based on the size of the pool
                  field.
                </div>
              </div>
              <div style={{ margin: isMobile ? '12px 0' : '20px 0', borderTop: '1px solid #d7dee6' }} />
              <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 700, color: '#0f1720' }}>
                <span style={{ marginRight: 6 }}>💰</span>
                Entry &amp; Contact
              </div>
              <div style={{ marginTop: isMobile ? 8 : 14, display: 'grid', gap: isMobile ? 6 : 10, color: '#0f1720', lineHeight: 1.5, fontSize: isMobile ? 12 : 15 }}>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  Entry Fee: $30
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  Venmo:{' '}
                  {isMobile ? (
                    <a
                      href="venmo://paycharge?txn=pay&recipients=claytont743&amount=30&note=Golf%20Majors%20Pool"
                      style={{ color: '#3d95ce', textDecoration: 'none', fontWeight: 600 }}
                    >
                      @claytont743
                    </a>
                  ) : '@claytont743'}
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  <span style={{ color: '#dc2626', fontWeight: 800, fontSize: isMobile ? 14 : 20, marginRight: 4 }}>?</span>
                  <span style={{ marginRight: 8 }}>:</span>
                  <span>Clayton Tucker</span>
                  <span style={{ margin: '0 3px 0 6px' }}>📞</span>
                  {isMobile ? (
                    <a
                      href="tel:+13256658299"
                      style={{ color: '#3d95ce', textDecoration: 'none', fontWeight: 600 }}
                    >
                      (325.665.8299)
                    </a>
                  ) : '(325.665.8299)'}
                </div>
              </div>
              <div style={{ margin: isMobile ? '12px 0 10px' : '24px 0 18px', borderTop: '1px solid #d7dee6' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 13 : 18, fontWeight: 700, color: '#0f1720' }}>
                <span>{'📊'}</span>
                <span>Points are awarded as follows:</span>
              </div>
              <div
                style={{
                  marginTop: isMobile ? 10 : 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: isMobile ? 16 : 36,
                  color: '#0f1720',
                  fontSize: isMobile ? 11 : 15,
                  lineHeight: 1.35,
                }}
              >
                <div style={{ display: 'grid', gap: isMobile ? 5 : 8 }}>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Triple+:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-5 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Double:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-3 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Bogey:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-1 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Par:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>.5 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Birdie:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>3 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Eagle:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>8 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Albatross:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>13 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Ace:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>10 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>3 Birdie Streak:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>4 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>No Bogey Rnd:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Tourn Low Rnd:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>6 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Rnd 1 Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Rnd 2 Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Rnd 3 Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                </div>
                <div style={{ display: 'grid', gap: isMobile ? 5 : 8 }}>
                  <div style={{ display: 'grid', gap: isMobile ? 5 : 8 }}>
                    <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><span style={{ marginRight: 6 }}>{'🥇'}</span><strong>1st Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>40 pts</span></div>
                    <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><span style={{ marginRight: 6 }}>{'🥈'}</span><strong>2nd Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>25 pts</span></div>
                    <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><span style={{ marginRight: 6 }}>{'🥉'}</span><strong>3rd Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>20 pts</span></div>
                  </div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>4th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>18 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>5th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>16 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>6th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>14 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>7th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>12 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>8th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>10 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>9th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>9 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>10th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>8 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>11-15th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>7 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>16-20th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>6 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>21-25th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>26-30th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>3 pts</span></div>
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>31-40th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>1 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: isMobile ? 11 : 15, fontWeight: 800 }}><strong>Cut Players:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-10 pts</span></div>
                </div>
              </div>
            </section>
          </main>
        )}

        {mainTab === 'Commissioner Hub' && (
          <main style={{ marginTop: isMobile ? 12 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            {commissionerConsoleView === 'dashboard' ? (
              <>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Commissioner Hub
              </div>
              <h2 style={{ margin: isMobile ? '4px 0 10px' : '6px 0 18px', fontSize: isMobile ? 16 : 26, color: '#0f1720' }}>
                Live feed and pool status for {tournament.name}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: isMobile ? 8 : 14,
                }}
              >
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Source
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>ESPN</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Last sync
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>{formatRefresh(feed?.fetchedAt ?? null)}</div>
                </div>
                <button
                  onClick={handleToggleLineupLock}
                  disabled={!canManagePool || commissionerBusy}
                  style={{
                    border: '1px solid #e6edf1',
                    borderRadius: isMobile ? 12 : 18,
                    padding: isMobile ? 10 : 16,
                    background: '#f8fbfd',
                    textAlign: 'left',
                    cursor: !canManagePool || commissionerBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Lineup lock
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>{locked ? 'Locked' : 'Unlocked'}</div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 11 : 13, color: '#5b6b79' }}>
                    {locked ? 'Click to unlock roster editing' : 'Click to lock roster editing'}
                  </div>
                </button>
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Pool members
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>{commissionerMembers.length > 0 ? commissionerMembers.length : poolEntries.length}</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: isMobile ? 8 : 16,
                  border: '1px solid #e6edf1',
                  borderRadius: isMobile ? 12 : 18,
                  padding: isMobile ? 10 : 16,
                  background: '#f8fbfd',
                  display: 'grid',
                  gap: isMobile ? 8 : 14,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Tournament payouts
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800, color: '#0f1720' }}>
                    {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name}
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 6, fontSize: isMobile ? 11 : 13, color: '#5b6b79' }}>
                    Set the 1st, 2nd, and 3rd place payout amounts for the upcoming or active tournament.
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                      1st place
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={payoutForm.first}
                      onChange={(event) => setPayoutForm((current) => ({ ...current, first: event.target.value }))}
                      placeholder="0"
                      style={fieldStyle()}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                      2nd place
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={payoutForm.second}
                      onChange={(event) => setPayoutForm((current) => ({ ...current, second: event.target.value }))}
                      placeholder="0"
                      style={fieldStyle()}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                      3rd place
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={payoutForm.third}
                      onChange={(event) => setPayoutForm((current) => ({ ...current, third: event.target.value }))}
                      placeholder="0"
                      style={fieldStyle()}
                    />
                  </label>
                  <button
                    onClick={handleSavePayouts}
                    disabled={!canManagePool || commissionerBusy}
                    style={{
                      border: 'none',
                      borderRadius: 14,
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                      color: '#fff',
                      fontWeight: 900,
                      cursor: !canManagePool || commissionerBusy ? 'not-allowed' : 'pointer',
                      minHeight: 52,
                    }}
                  >
                    Save payouts
                  </button>
                </div>
              </div>
            </section>

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <button
                onClick={() => setCommissionerConsoleView('members')}
                style={{
                  width: '100%',
                  border: '1px solid #d7e0e8',
                  borderRadius: isMobile ? 14 : 22,
                  background: '#fff',
                  padding: isMobile ? 12 : 22,
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '52px minmax(0, 1fr)' : '100px minmax(0, 1fr)',
                  gap: isMobile ? 12 : 22,
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: isMobile ? 52 : 82,
                    height: isMobile ? 52 : 82,
                    borderRadius: isMobile ? 12 : 18,
                    background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={isMobile ? 28 : 46} />
                </div>
                <div>
                  <div style={{ fontSize: isMobile ? 18 : 32, fontWeight: 900, color: '#0f1720' }}>Member Management</div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 12 : 18, lineHeight: 1.45, color: '#31424f' }}>
                    A full member listing showing participation for this year.
                  </div>
                </div>
              </button>
            </section>

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Submission status
              </div>
              <h2 style={{ margin: isMobile ? '4px 0 10px' : '6px 0 18px', fontSize: isMobile ? 16 : 26, color: '#0f1720' }}>
                {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name} pick submissions
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isMobile ? 10 : 20,
                }}
              >
                <div
                  style={{
                    flex: '1 1 0',
                    border: '1px solid #d7e0e8',
                    borderRadius: isMobile ? 12 : 20,
                    padding: isMobile ? 10 : 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 900, color: '#0f1720' }}>Submitted Picks</div>
                  {submittedCommissionerMembers.length > 0 ? (
                    submittedCommissionerMembers.map((member) => (
                      <div
                        key={`submitted-${member.id}`}
                        style={{ borderRadius: 10, background: '#fff', padding: isMobile ? '6px 8px' : '12px 14px', color: '#0f1720', fontWeight: 700, fontSize: isMobile ? 12 : 14 }}
                      >
                        {member.displayName}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88', fontSize: isMobile ? 11 : 14 }}>No registered members have submitted picks yet.</div>
                  )}
                </div>

                <div
                  style={{
                    flex: '1 1 0',
                    border: '1px solid #d7e0e8',
                    borderRadius: isMobile ? 12 : 20,
                    padding: isMobile ? 10 : 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 900, color: '#0f1720' }}>Still Need Picks</div>
                  {pendingCommissionerMembers.length > 0 ? (
                    pendingCommissionerMembers.map((member) => (
                      <div
                        key={`pending-${member.id}`}
                        style={{ borderRadius: 10, background: '#fff', padding: isMobile ? '6px 8px' : '12px 14px', color: '#0f1720', fontWeight: 700, fontSize: isMobile ? 12 : 14 }}
                      >
                        {member.displayName}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88', fontSize: isMobile ? 11 : 14 }}>Everyone with a registered account has submitted picks.</div>
                  )}
                </div>
              </div>
            </section>
              </>
            ) : commissionerConsoleView === 'members' ? (
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'grid',
                gap: isMobile ? 10 : 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 10 : 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                  <button
                    onClick={() => { setCommissionerConsoleView('dashboard'); setShowAddMemberForm(false); }}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 999,
                      background: '#fff',
                      width: isMobile ? 32 : 44,
                      height: isMobile ? 32 : 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <ArrowLeft size={isMobile ? 14 : 20} />
                  </button>
                  <div>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 34, color: '#0f1720' }}>Member Management</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberForm((current) => !current)}
                  style={{
                    border: 'none',
                    borderRadius: 14,
                    padding: isMobile ? '8px 12px' : '12px 18px',
                    background: '#2d5e94',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: isMobile ? 12 : 14,
                    cursor: 'pointer',
                  }}
                >
                  {showAddMemberForm ? 'Close Add Members' : 'Add Members'}
                </button>
              </div>

              {showAddMemberForm ? (
                <div
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 20,
                    padding: 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720' }}>Add a new member</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <input
                      value={memberCreateForm.displayName}
                      onChange={(event) => setMemberCreateForm({ ...memberCreateForm, displayName: event.target.value })}
                      placeholder="Display name"
                      style={fieldStyle()}
                    />
                    <input
                      value={memberCreateForm.email}
                      onChange={(event) => setMemberCreateForm({ ...memberCreateForm, email: event.target.value })}
                      placeholder="Email"
                      style={fieldStyle()}
                    />
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showMemberPassword ? 'text' : 'password'}
                        value={memberCreateForm.password}
                        onChange={(event) => setMemberCreateForm({ ...memberCreateForm, password: event.target.value })}
                        placeholder="Password"
                        style={{ ...fieldStyle(), paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMemberPassword((v) => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7b88', display: 'flex', alignItems: 'center' }}
                      >
                        {showMemberPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleCreateMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Create member
                    </button>
                  </div>
                </div>
              ) : null}

              {commissionerError ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 16,
                    background: '#fff5f5',
                    color: '#a61b1b',
                    border: '1px solid #fecaca',
                    padding: '14px 16px',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{commissionerError}</span>
                </div>
              ) : null}

              {commissionerSuccess ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 16,
                    background: '#eef4ff',
                    color: '#2f5f96',
                    border: '1px solid #c7d8ee',
                    padding: '14px 16px',
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{commissionerSuccess}</span>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 8 : 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: '#31424f' }}>
                  {commissionerMembers.length} Active Members
                </div>
                <div
                  style={{
                    minWidth: isMobile ? 0 : 280,
                    maxWidth: 360,
                    flex: isMobile ? '1 1 auto' : '1 1 280px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #d7e0e8',
                    borderRadius: 12,
                    background: '#fff',
                    padding: isMobile ? '8px 10px' : '12px 14px',
                  }}
                >
                  <Search size={isMobile ? 14 : 18} color="#6b7b88" />
                  <input
                    value={commissionerMemberSearch}
                    onChange={(event) => setCommissionerMemberSearch(event.target.value)}
                    placeholder="Search"
                    style={{ ...fieldStyle(), border: 'none', outline: 'none', padding: 0, fontSize: isMobile ? 16 : 15 }}
                  />
                  {commissionerMemberSearch && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setCommissionerMemberSearch(''); }}
                      style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                      aria-label="Clear search"
                    >
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 14 : 22, overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', background: '#fff' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '140px 190px 100px 46px' : 'minmax(220px, 1.1fr) minmax(260px, 1.25fr) minmax(180px, 0.8fr) 90px',
                    gap: isMobile ? 8 : 16,
                    padding: isMobile ? '8px 12px' : '18px 22px',
                    background: '#f8fbfd',
                    color: '#5b6b79',
                    fontSize: isMobile ? 10 : 13,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  {(['displayName', 'email'] as const).map((col) => (
                    <div
                      key={col}
                      style={{
                        display: 'flex',
                        justifyContent: (!isMobile && col === 'email') ? 'center' : 'flex-start',
                        ...(isMobile && col === 'displayName' ? { position: 'sticky', left: 0, background: '#f8fbfd', zIndex: 2 } : {}),
                      }}
                    >
                      <button
                        onClick={() => setCommissionerMemberSort((prev) => ({
                          column: col,
                          direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc',
                        }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#5b6b79', fontSize: isMobile ? 10 : 13, fontWeight: 800, textTransform: 'uppercase' }}
                      >
                        {col === 'displayName' ? 'Display Name' : 'Email'}
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                          <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === col && commissionerMemberSort.direction === 'asc' ? 1 : 0.3 }}>▲</span>
                          <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === col && commissionerMemberSort.direction === 'desc' ? 1 : 0.3 }}>▼</span>
                        </span>
                      </button>
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', fontSize: isMobile ? 9 : 13 }}># of Tourn. Submitted Picks</div>
                  <div style={{ textAlign: 'center', ...(isMobile ? { position: 'sticky', right: 0, background: '#f8fbfd', zIndex: 2 } : {}) }}>Edit</div>
                </div>

                {commissionerBusy && commissionerMembers.length === 0 ? (
                  <div style={{ padding: isMobile ? 14 : 24, color: '#6b7b88', fontSize: isMobile ? 12 : 14 }}>Loading members...</div>
                ) : filteredCommissionerMembers.length === 0 ? (
                  <div style={{ padding: isMobile ? 14 : 24, color: '#6b7b88', fontSize: isMobile ? 12 : 14 }}>No members matched your search.</div>
                ) : (
                  filteredCommissionerMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '140px 190px 100px 46px' : 'minmax(220px, 1.1fr) minmax(260px, 1.25fr) minmax(180px, 0.8fr) 90px',
                        gap: isMobile ? 8 : 16,
                        padding: isMobile ? '10px 12px' : '20px 22px',
                        borderTop: '1px solid #e6edf1',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 800, color: '#0f1720', display: 'flex', alignItems: 'center', gap: 6, ...(isMobile ? { position: 'sticky', left: 0, background: '#fff', zIndex: 1, paddingRight: 4 } : {}) }}>
                        {member.displayName}
                        {member.email.trim().toLowerCase() === COMMISSIONER_EMAIL && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2d5e94', color: '#fff', borderRadius: 4, width: isMobile ? 16 : 20, height: isMobile ? 16 : 20, fontSize: isMobile ? 10 : 12, fontWeight: 900, flexShrink: 0 }}>C</span>
                        )}
                      </div>
                      <div style={{ fontSize: isMobile ? 11 : 15, color: '#31424f', textAlign: isMobile ? 'left' : 'center' }}>{member.email}</div>
                      <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: '#0f1720', textAlign: 'center' }}>
                        {TOURNAMENTS.filter((event) => (member.rosters[event.id] ?? []).length > 0).length}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', ...(isMobile ? { position: 'sticky', right: 0, background: '#fff', zIndex: 1 } : {}) }}>
                        <button
                          onClick={() => openCommissionerMemberModal(member.id)}
                          style={{
                            border: '1px solid #d7e0e8',
                            borderRadius: isMobile ? 10 : 14,
                            background: '#fff',
                            width: isMobile ? 34 : 48,
                            height: isMobile ? 34 : 48,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            ) : commissionerConsoleView === 'member-picks' ? (
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setCommissionerConsoleView('members');
                    setCommissionerRosterMemberId(null);
                  }}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 34, color: '#0f1720' }}>
                  Pick Sheet for {commissionerRosterMember?.displayName ?? 'Member'}
                </h2>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(320px, 0.8fr)',
                  gap: 22,
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={{ border: '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
                    <div
                      style={{
                        padding: isMobile ? 12 : 22,
                        background: '#f7f9fb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexWrap: 'wrap',
                        borderBottom: '1px solid #d7e0e8',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>
                          {commissionerTournamentLabel}
                        </div>
                        <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>
                          Tournament Field
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 8,
                            color: '#5b6b79',
                          }}
                        >
                          <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                          <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                        </div>
                      </div>
                      <label
                        style={{
                          minWidth: isMobile ? 140 : 280,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          border: '1px solid #d7e0e8',
                          borderRadius: 14,
                          background: '#fff',
                          padding: '0 14px',
                        }}
                      >
                        <Search size={18} color="#6b7b88" />
                        <input
                          value={commissionerPlayerSearch}
                          onChange={(event) => setCommissionerPlayerSearch(event.target.value)}
                          placeholder="Search"
                          style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            padding: isMobile ? '10px 0' : '12px 0',
                            fontSize: isMobile ? 16 : 15,
                            background: 'transparent',
                            color: '#0f1720',
                          }}
                        />
                        {commissionerPlayerSearch && (
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setCommissionerPlayerSearch(''); }}
                            style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                            aria-label="Clear search"
                          >
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                          </button>
                        )}
                      </label>
                    </div>

                    <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: '1px solid #e6edf1', position: 'sticky', top: 0, background: '#f7f9fb', zIndex: 1 }}>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720', textAlign: 'center' }}>OWGR</div>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720' }}>Salary</div>
                        <div></div>
                      </div>
                      {filteredCommissionerPlayers.map((player) => {
                        const isDisabled = commissionerRosterSelection.length >= REQUIRED_GOLFERS || player.salary > commissionerSalaryRemaining;

                        return (
                          <div
                            key={`commissioner-player-${player.id}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px',
                              padding: isMobile ? '11px 12px' : '15px 20px',
                              borderBottom: '1px solid #e6edf1',
                              alignItems: 'center',
                              opacity: isDisabled ? 0.45 : 1,
                              background: '#fff',
                            }}
                          >
                            <div style={{ fontSize: isMobile ? 13 : 17, color: '#0f1720', textAlign: 'center' }}>{player.worldRank}</div>
                            <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 600, color: '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>{player.name}</div>
                            <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, color: '#0f1720' }}>${player.salary.toLocaleString()}</div>
                            <button
                              onClick={() => toggleCommissionerRosterPlayer(player.id)}
                              disabled={isDisabled}
                              style={{
                                width: isMobile ? 34 : 42,
                                height: isMobile ? 34 : 42,
                                borderRadius: 10,
                                border: '1px solid #d7dee6',
                                background: '#fff',
                                color: '#0f1720',
                                fontSize: isMobile ? 20 : 24,
                                fontWeight: 400,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={{ border: '1px solid #d7e0e8', borderRadius: isMobile ? 18 : 14, padding: isMobile ? 16 : '12px 18px', background: '#fff' }}>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 30 : 34, fontWeight: 900, color: '#1f8d4e' }}>${commissionerSalaryRemaining.toLocaleString()}</div>
                    <div style={{ marginTop: isMobile ? 8 : 4, fontSize: isMobile ? 12 : 13, color: '#31424f' }}>
                      Avg Rem./Player: ${commissionerAverageRemainingPerPlayer.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ fontSize: isMobile ? 12 : 13, color: '#607282', marginTop: -4 }}>
                      Click the plus sign to add a golfer or the minus sign to remove them.
                    </div>

                    {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                      const golfer = commissionerOrderedRosterPlayers[index];
                      return (
                        <div
                          key={`commissioner-roster-slot-${index}`}
                          style={{
                            border: '1px solid #d7e0e8',
                            borderRadius: isMobile ? 14 : 14,
                            background: '#fff',
                            minHeight: isMobile ? 100 : undefined,
                            height: isMobile ? undefined : 96,
                            display: 'flex',
                            overflow: 'hidden',
                          }}
                        >
                            {golfer ? (
                              <>
                                <div style={{ width: isMobile ? 90 : 88, flexShrink: 0, alignSelf: 'stretch', background: '#fff', overflow: 'hidden', position: 'relative' }}>
                                  <img
                                    src={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)}
                                    alt={golfer.name}
                                    className="roster-card-photo"
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                </div>
                                <div style={{ flex: 1, padding: isMobile ? '8px 14px' : '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                  <div>
                                    <div style={{ fontSize: isMobile ? 18 : 19, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                                    <div style={{ marginTop: isMobile ? 3 : 2, fontSize: isMobile ? 15 : 15, color: '#607282' }}>
                                      Salary: <span style={{ fontWeight: 800, color: '#3f73ad' }}>${golfer.salary.toLocaleString()}</span>
                                    </div>
                                    <div style={{ marginTop: isMobile ? 2 : 1, fontSize: isMobile ? 14 : 13, color: '#607282' }}>
                                      World Rank: <span style={{ fontWeight: 700, color: '#0f1720' }}>{golfer.worldRank}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleCommissionerRosterPlayer(golfer.id)}
                                    style={{
                                      width: isMobile ? 34 : 30,
                                      height: isMobile ? 34 : 30,
                                      borderRadius: 8,
                                      border: '1px solid #d7dee6',
                                      background: '#fff',
                                      color: '#0f1720',
                                      fontSize: isMobile ? 20 : 18,
                                      fontWeight: 400,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    −
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div style={{ flex: 1, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14 }}>
                                <div style={{ width: isMobile ? 62 : 72, height: isMobile ? 62 : 72, borderRadius: 6, background: '#e8eef4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <CircleUserRound size={isMobile ? 32 : 40} color="#a0b0be" />
                                </div>
                                <div style={{ fontSize: isMobile ? 16 : 18, color: '#50616f', fontWeight: 600 }}>Golfer #{index + 1}</div>
                              </div>
                            )}
                        </div>
                      );
                    })}

                    <input
                      value={commissionerTieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setCommissionerTieBreakInput(val);
                      }}
                      placeholder={`Enter tiebreak value* (Par = ${TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '?'})`}
                      inputMode="numeric"
                      maxLength={3}
                      style={{ ...fieldStyle(), marginTop: 4 }}
                    />

                    <button
                      onClick={handleSaveCommissionerRoster}
                      disabled={!canSaveCommissionerRoster || commissionerBusy}
                      style={{
                        marginTop: 4,
                        width: 'fit-content',
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 18px',
                        background: canSaveCommissionerRoster ? 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)' : '#f2f4f6',
                        color: canSaveCommissionerRoster ? '#fff' : '#98a3ad',
                        boxShadow: canSaveCommissionerRoster ? '0 14px 28px rgba(63, 115, 173, 0.22)' : 'none',
                        fontWeight: 900,
                        cursor: !canSaveCommissionerRoster || commissionerBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Submit Roster
                    </button>

                    <div style={{ fontSize: 13, color: '#607282', marginTop: 4 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament. Use their total strokes, NOT score to par. Example: Enter 274 (NOT -14)
                    </div>
                  </div>
                </div>
              </div>
            </section>
            ) : null}
          </main>
        )}

        {commissionerMemberModalOpen && selectedCommissionerMember ? (
          <div
            onClick={() => setCommissionerMemberModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                background: '#fff',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>Member options</div>
                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, color: '#0f1720' }}>
                    {selectedCommissionerMember.displayName}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15, color: '#607282' }}>{selectedCommissionerMember.email}</div>
                </div>
                <button
                  onClick={() => setCommissionerMemberModalOpen(false)}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              {commissionerMemberModalView === 'menu' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <button
                    onClick={() => setCommissionerMemberModalView('displayName')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Display Name
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('email')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Email
                  </button>
                  <button
                    onClick={() => openCommissionerMemberPicks(selectedCommissionerMember.id)}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#eef8fb',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Manage or Submit Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmClearPicks')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fcd9a0',
                      borderRadius: 16,
                      background: '#fff8ee',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a06000',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Clear Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmDelete')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: 16,
                      background: '#fff5f5',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a61b1b',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Delete Member
                  </button>
                </div>
              ) : commissionerMemberModalView === 'displayName' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <input
                    value={memberEditForm.displayName}
                    onChange={(event) => setMemberEditForm({ ...memberEditForm, displayName: event.target.value })}
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Display Name
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmClearPicks' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to clear picks for <strong>{selectedCommissionerMember?.displayName}</strong>? Their submitted roster will be removed for this tournament.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearCommissionerMemberPicks}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a06000',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Clear
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmDelete' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to delete <strong>{selectedCommissionerMember?.displayName}</strong>? This cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a61b1b',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '0 14px',
                    }}
                  >
                    <Mail size={18} color="#607282" />
                    <input
                      value={memberEditForm.email}
                      onChange={(event) => setMemberEditForm({ ...memberEditForm, email: event.target.value })}
                      placeholder="Email"
                      style={{ ...fieldStyle(), border: 'none', paddingLeft: 0, paddingRight: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeStandingEntry ? (
          <div
            onClick={() => {
              setShowPointsSystem(false);
              setActiveStandingGolferId(null);
              setActiveStandingEntryId(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 50,
            }}
          >
            <div
              ref={entryBreakdownRef}
              onClick={(event) => event.stopPropagation()}
              className="breakdown-modal entry-breakdown-modal"
              style={{
                width: 'min(480px, 100%)',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto',
                background: (selectedTournament === 'open' || selectedTournament === 'players') && !showFutureTournamentView ? '#F4BC41' : '#fff',
                borderRadius: 20,
                padding: isMobile ? 16 : 12,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '4px 0 0', fontSize: 20, color: '#0f1720' }}>
                    {activeStandingEntry.name} - {tournament.name}
                  </h3>
                  <div style={{ marginTop: 2, color: (selectedTournament === 'players' || selectedTournament === 'open') ? '#374151' : '#6b7b88', fontSize: isMobile ? 10.5 : 12 }}>
                    {isMobile
                      ? `*Tap player for details; Tap "${currentRoundLabel}" for scorecard`
                      : `*Click player for scoring details; Click "${currentRoundLabel}" for scorecard`}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPointsSystem(false);
                    setActiveStandingGolferId(null);
                    setActiveStandingEntryId(null);
                  }}
                  style={{
                    border: (selectedTournament === 'players' || selectedTournament === 'open') ? '2px solid #374151' : '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: (selectedTournament === 'open' || selectedTournament === 'players') && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    padding: '8px 14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    color: (selectedTournament === 'players' || selectedTournament === 'open') ? '#374151' : '#0f1720',
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ marginTop: isMobile ? 12 : 10, display: 'grid', gap: isMobile ? 8 : 8 }}>
                {activeStandingEntry.golfers.length > 0 ? (
                  activeStandingGolfers.map((golfer, index) => {
                    const isActiveGolfer = activeStandingGolferId === golfer.id;

                    return (
                    <button
                      key={golfer.id}
                      onClick={() => setActiveStandingGolferId(golfer.id)}
                      style={{
                        width: '100%',
                        border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e6edf1',
                        borderRadius: 12,
                        padding: 0,
                        background: isActiveGolfer ? '#eef4ff' : '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        overflow: 'hidden',
                        minHeight: isMobile ? 85 : 100,
                      }}
                    >
                      {isMobile ? (
                        <>
                          <div style={{ width: 86, flexShrink: 0, alignSelf: 'stretch', position: 'relative', background: '#fff' }}>
                            <img
                              src={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)}
                              alt={golfer.name}
                              className="breakdown-golfer-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="breakdown-golfer-name" style={{ fontSize: 16, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                              <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#6b7b88', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {golfer.score === 'CUT' || golfer.score === 'MDF' ? <span>Total: {golfer.originalScore ?? '--'}</span> : <span>Holes Rem: {golfer.holesRemaining}</span>}
                                <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>
                              </div>
                              {golfer.score === 'CUT' || golfer.score === 'MDF' ? (
                                <>
                                  {showProjectedCut && golfer.currentRoundScore && (
                                    <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#50616f', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScorecardGolferName(golfer.name);
                                          setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                          setScorecardGolferTeeTime(golfer.teeTime);
                                          setScorecardGolferThru(golfer.thru);
                                          setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                          setScorecardData(null);
                                          setScorecardLoading(true);
                                          fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=2`)
                                            .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                        }}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none' }}
                                      >
                                        <span style={{ textDecoration: 'underline' }}>Round 2</span>:{' '}<span style={{ color: '#50616f', fontWeight: 400 }}>{golfer.currentRoundScore}</span>
                                      </button>
                                    </div>
                                  )}
                                  <div className="breakdown-golfer-subtext" style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#cc2944' }}>MISSED CUT</div>
                                </>
                              ) : (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#6b7b88', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>Total: {golfer.score}</span>
                                  <span>Position: {formatPosition(golfer.position)}</span>
                                </div>
                              )}
                              {golfer.score !== 'CUT' && golfer.score !== 'MDF' && (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#50616f', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScorecardGolferName(golfer.name);
                                      setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                      setScorecardGolferTeeTime(golfer.teeTime);
                                      setScorecardGolferThru(golfer.thru);
                                      setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                      setScorecardData(null);
                                      setScorecardLoading(true);
                                      fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=${currentRoundLabel.replace('Round ', '')}`)
                                        .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none' }}
                                  >
                                    <span style={{ textDecoration: 'underline' }}>{currentRoundLabel}</span>:{' '}<span style={{ color: '#50616f', fontWeight: 400 }}>{golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime ? formatTeeTime(golfer.teeTime) : formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}</span>
                                  </button>
                                  {!(golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime) && <span>Thru: {golfer.thru}{golfer.backNineStart && golfer.thru !== '--' && golfer.thru !== 'F' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                              <div className="breakdown-golfer-points" style={{ fontSize: 22, fontWeight: 900, color: golfer.points < 0 ? '#dc2626' : selectedTournament === 'masters' ? '#2c6449' : '#2f5f96' }}>{formatPointValue(golfer.points)}</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: 76, flexShrink: 0, alignSelf: 'stretch', position: 'relative', background: '#fff' }}>
                            <img
                              src={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)}
                              alt={golfer.name}
                              className="breakdown-golfer-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="breakdown-golfer-name" style={{ fontSize: 14, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                              <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#6b7b88', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {golfer.score === 'CUT' || golfer.score === 'MDF' ? <span>Total: {golfer.originalScore ?? '--'}</span> : <span>Holes Rem: {golfer.holesRemaining}</span>}
                                <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>
                              </div>
                              {golfer.score === 'CUT' || golfer.score === 'MDF' ? (
                                <>
                                  {showProjectedCut && golfer.currentRoundScore && (
                                    <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#50616f', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScorecardGolferName(golfer.name);
                                          setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                          setScorecardGolferTeeTime(golfer.teeTime);
                                          setScorecardGolferThru(golfer.thru);
                                          setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                          setScorecardData(null);
                                          setScorecardLoading(true);
                                          fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=2`)
                                            .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                        }}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none' }}
                                      >
                                        <span style={{ textDecoration: 'underline' }}>Round 2</span>:{' '}<span style={{ color: '#50616f', fontWeight: 400 }}>{golfer.currentRoundScore}</span>
                                      </button>
                                    </div>
                                  )}
                                  <div className="breakdown-golfer-subtext" style={{ marginTop: 2, fontSize: 11, fontWeight: 800, color: '#cc2944' }}>MISSED CUT</div>
                                </>
                              ) : (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#6b7b88', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>Total: {golfer.score}</span>
                                  <span>Position: {formatPosition(golfer.position)}</span>
                                </div>
                              )}
                              {golfer.score !== 'CUT' && golfer.score !== 'MDF' && (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#50616f', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScorecardGolferName(golfer.name);
                                      setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                      setScorecardGolferTeeTime(golfer.teeTime);
                                      setScorecardGolferThru(golfer.thru);
                                      setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                      setScorecardData(null);
                                      setScorecardLoading(true);
                                      fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=${currentRoundLabel.replace('Round ', '')}`)
                                        .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none' }}
                                  >
                                    <span style={{ textDecoration: 'underline' }}>{currentRoundLabel}</span>:{' '}<span style={{ color: '#50616f', fontWeight: 400 }}>{golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime ? formatTeeTime(golfer.teeTime) : formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}</span>
                                  </button>
                                  {!(golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime) && <span>Thru: {golfer.thru}{golfer.backNineStart && golfer.thru !== '--' && golfer.thru !== 'F' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                              <div className="breakdown-golfer-points" style={{ fontSize: 18, fontWeight: 900, color: golfer.points < 0 ? '#dc2626' : selectedTournament === 'masters' ? '#2c6449' : '#2f5f96' }}>{formatPointValue(golfer.points)}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  )})
                ) : (
                  <div
                    style={{
                      borderRadius: 18,
                      border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e6edf1',
                      background: selectedTournament === 'open' ? '#F4BC41' : '#f8fbfd',
                      padding: 18,
                      color: (selectedTournament === 'players' || selectedTournament === 'open') ? '#374151' : '#50616f',
                    }}
                  >
                    No lineup has been saved for this team yet.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: isMobile ? 18 : 14,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 16,
                  alignItems: 'center',
                  borderTop: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e6edf1',
                  paddingTop: isMobile ? 16 : 14,
                }}
              >
                <div style={{ color: (selectedTournament === 'players' || selectedTournament === 'open') ? '#374151' : '#50616f', fontSize: isMobile ? 18 : 17 }}>
                  Total Holes Rem: <strong>{activeStandingEntry.holesRemaining}</strong>
                </div>
  <div style={{ fontSize: isMobile ? 18 : 17, fontWeight: 800, color: '#0f1720' }}>
                  Total: {formatPointValue(activeStandingEntry.rosterPoints)}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeStandingGolfer ? (
          <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              setShowPointsSystem(false);
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setActiveStandingGolferId(null);
              } else {
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="breakdown-modal scoring-breakdown-modal"
              style={{
                width: 'min(480px, 100%)',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 20,
                padding: 0,
                overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <img
                    src={activeStandingGolfer.photoUrl ?? pgaPhoto(activeStandingGolfer.pgaTourId)}
                    alt={activeStandingGolfer.name}
                    className="breakdown-scoring-photo"
                    style={{ width: 72, objectFit: 'cover', objectPosition: 'top center', flexShrink: 0, background: '#fff', display: 'block', marginLeft: 16 }}
                  />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '14px 14px 14px 12px' }}>
                  <div style={{ marginTop: 4 }}>
                    <h3 className="breakdown-scoring-name" style={{ margin: '0 0 6px', fontSize: 20, color: '#0f1720' }}>{activeStandingGolfer.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                      <div
                        style={{
                          borderRadius: 999,
                          background: selectedTournament === 'masters' ? '#dcfce7' : '#eef4ff',
                          border: `1px solid ${selectedTournament === 'masters' ? '#86efac' : '#c7d8ee'}`,
                          padding: '3px 8px',
                          fontSize: 13,
                          fontWeight: 900,
                          color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96',
                          lineHeight: 1.2,
                          flexShrink: 0,
                        }}
                      >
                        Points: {formatPointValue(activeStandingGolfer.points)}
                      </div>
                      <button
                        onClick={() => setShowPointsSystem(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: 12,
                          color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isMobile ? 'Tap for points system' : 'Click here for points system'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowPointsSystem(false); setActiveStandingGolferId(null); }}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 999,
                      background: '#fff',
                      padding: '8px 14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 3, display: 'grid', gap: 8, padding: '0 16px 16px' }}>
                {[
                  ['Pars', activeStandingGolfer.scoreBreakdown.statLine.par, activeStandingGolfer.scoreBreakdown.statLine.par * SCORING_RULES.par],
                  ['Birdies', activeStandingGolfer.scoreBreakdown.statLine.birdie, activeStandingGolfer.scoreBreakdown.statLine.birdie * SCORING_RULES.birdie],
                  ['Eagles', activeStandingGolfer.scoreBreakdown.statLine.eagle, activeStandingGolfer.scoreBreakdown.statLine.eagle * SCORING_RULES.eagle],
                  ['Albatrosses', activeStandingGolfer.scoreBreakdown.statLine.albatross, activeStandingGolfer.scoreBreakdown.statLine.albatross * SCORING_RULES.albatross],
                  ['Aces', activeStandingGolfer.scoreBreakdown.statLine.holeInOne, activeStandingGolfer.scoreBreakdown.statLine.holeInOne * SCORING_RULES.holeInOne],
                  ['Bogeys', activeStandingGolfer.scoreBreakdown.statLine.bogey, activeStandingGolfer.scoreBreakdown.statLine.bogey * SCORING_RULES.bogey],
                  ['Double Bogeys', activeStandingGolfer.scoreBreakdown.statLine.doubleBogey, activeStandingGolfer.scoreBreakdown.statLine.doubleBogey * SCORING_RULES.doubleBogey],
                  ['Triple Bogey+', activeStandingGolfer.scoreBreakdown.statLine.tripleOrWorse, activeStandingGolfer.scoreBreakdown.statLine.tripleOrWorse * SCORING_RULES.tripleOrWorse],
                  ['3 Birdie Streaks', activeStandingGolfer.scoreBreakdown.statLine.threeBirdieStreaks, activeStandingGolfer.scoreBreakdown.statLine.threeBirdieStreaks * SCORING_RULES.threeBirdieStreak],
                  ['No Bogey Rnds', activeStandingGolfer.scoreBreakdown.statLine.bogeyFreeRounds, activeStandingGolfer.scoreBreakdown.statLine.bogeyFreeRounds * SCORING_RULES.bogeyFreeRound],
                  ['Tourn Low Rnd', activeStandingGolfer.scoreBreakdown.statLine.lowRounds, activeStandingGolfer.scoreBreakdown.statLine.lowRounds * SCORING_RULES.tourneyLowRound],
                  ['Rnd 1 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.first ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.first ? SCORING_RULES.firstRoundLeader : 0],
                  ['Rnd 2 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.second ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.second ? SCORING_RULES.secondRoundLeader : 0],
                  ['Rnd 3 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.third ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.third ? SCORING_RULES.thirdRoundLeader : 0],
                ]
                  .filter(([, count]) => Number(count) > 0)
                  .concat([['Leaderboard Place', activeStandingGolfer.position, activeStandingGolfer.scoreBreakdown.madeCut === false ? activeStandingGolfer.scoreBreakdown.cutPenaltyPoints : activeStandingGolfer.scoreBreakdown.placementPoints] as const])
                  .map(([label, count, points]) => (
                  <div
                    key={String(label)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1.3fr) minmax(100px, 0.7fr) minmax(80px, 0.7fr)',
                      gap: 8,
                      alignItems: 'center',
                      border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e6edf1',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: (selectedTournament === 'open' || selectedTournament === 'players') && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f1720' }}>{label}</div>
                    <div style={{ color: (selectedTournament === 'players' || selectedTournament === 'open') ? '#4a5568' : '#6b7b88', fontSize: 12 }}>
                      {label === 'Leaderboard Place'
                        ? `Position: ${ordinal(String(count))}`
                        : ['Tourn Low Rnd', 'Rnd 1 Leader', 'Rnd 2 Leader', 'Rnd 3 Leader'].includes(String(label))
                        ? ''
                        : `Count: ${String(count)}`}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: Number(points) < 0 ? '#cc2944' : selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'players' || selectedTournament === 'open') ? '#173b63' : '#2f5f96' }}>
                      {formatPointValue(Number(points))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {showPointsSystem ? (
          <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setShowPointsSystem(false);
              } else {
                setShowPointsSystem(false);
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 70,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(500px, 100%)',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 20,
                padding: 16,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#0f1720' }}>
                  <span style={{ fontSize: 15 }}>{'📊'}</span>
                  <span>Points are awarded as follows:</span>
                </div>
                <button
                  onClick={() => setShowPointsSystem(false)}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    padding: '8px 14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Back
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 20,
                  color: '#0f1720',
                  fontSize: 13,
                  lineHeight: 1.35,
                }}
              >
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Triple+:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-5 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Double:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-3 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Bogey:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-1 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Par:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>.5 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Birdie:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>3 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Eagle:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>8 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Albatross:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>13 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Ace:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>10 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>3 Birdie Streak:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>4 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>No Bogey Rnd:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Tourn Low Rnd:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>6 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Rnd 1 Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Rnd 2 Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Rnd 3 Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}><span style={{ marginRight: 6 }}>{'🥇'}</span><strong>1st Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>40 pts</span></div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}><span style={{ marginRight: 6 }}>{'🥈'}</span><strong>2nd Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>25 pts</span></div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}><span style={{ marginRight: 6 }}>{'🥉'}</span><strong>3rd Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>20 pts</span></div>
                  </div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>4th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>18 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>5th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>16 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>6th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>14 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>7th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>12 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>8th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>10 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>9th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>9 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>10th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>8 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>11-15th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>7 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>16-20th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>6 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>21-25th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>26-30th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>3 pts</span></div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>31-40th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>1 pts</span></div>
                  <div style={{ margin: '4px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 13, fontWeight: 800 }}><strong>Cut Players:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-10 pts</span></div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Scorecard popup */}
        {scorecardGolferName ? (
          <div
            onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', overflow: 'hidden', background: '#fff', borderRadius: 20, padding: 0, boxShadow: '0 24px 60px rgba(9,34,51,0.25)' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <img
                  src={scorecardGolferPhoto ? (scorecardGolferPhoto.photoUrl ?? pgaPhoto(scorecardGolferPhoto.pgaTourId)) : ''}
                  alt={scorecardGolferName}
                  style={{ width: 60, objectFit: 'cover', objectPosition: 'top center', background: '#fff', flexShrink: 0, display: 'block', mixBlendMode: 'multiply', marginLeft: 20 }}
                />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '20px 20px 16px 20px' }}>
                  <div>
                    <div style={{ fontSize: !scorecardGolferName ? 19 : scorecardGolferName.length > 22 ? 13 : scorecardGolferName.length > 18 ? 15 : scorecardGolferName.length > 14 ? 17 : 19, fontWeight: 900, color: '#0f1720', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{scorecardGolferName}</div>
                    {(() => {
                      const playerNotStarted = scorecardGolferThru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS';
                      if (playerNotStarted && scorecardGolferTeeTime) {
                        const roundNum = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                        return (
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#2f5f96', display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
                            Round {roundNum}
                            <span style={{ fontWeight: 400, color: '#50616f', fontSize: 11 }}>{formatTeeTime(scorecardGolferTeeTime)}</span>
                          </div>
                        );
                      }
                      if (scorecardData && scorecardData.rounds.length > 0) {
                        const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                        return rnd && rnd.score != null && rnd.score !== '' ? (
                          <div style={{ fontSize: 12, fontWeight: 800, color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96', display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
                            Round {rnd.round}
                            <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 11 }}>Score: {rnd.score}{scorecardGolferBackNineStart && scorecardGolferThru !== '--' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>
                          </div>
                        ) : null;
                      }
                      return null;
                    })()}
                  </div>
                  <button
                    onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); }}
                    style={{ border: '1px solid #d7e0e8', borderRadius: 999, background: '#fff', padding: '8px 14px', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '0 20px 20px', overflowX: 'auto' }}>
              {scorecardLoading ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Loading scorecard…</div>
              ) : !scorecardData || scorecardData.rounds.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>
                  Scorecard data is not yet available for this round.
                </div>
              ) : (() => {
                // Show only the current (latest) round that has hole data
                const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                const front = rnd.holes.filter(h => h.hole <= 9);
                const back  = rnd.holes.filter(h => h.hole >= 10);
                const frontPar    = front.reduce((s, h) => s + (h.par || 0), 0);
                const backPar     = back.reduce((s,  h) => s + (h.par || 0), 0);
                const allScoresNull = rnd.holes.every(h => h.score == null);
                const frontScore  = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                const backScore   = allScoresNull ? 0 : back.reduce((s,  h) => s + (h.score ?? 0), 0);
                const totalScore  = frontScore + backScore;

                const border = '1px solid #d1d9e0';
                const thickBorder = '2px solid #9ab0c4';

                const isGoldTab = selectedTournament === 'open';
                const baseCell: React.CSSProperties = {
                  border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap',
                  ...(isGoldTab ? { background: '#F4BC41' } : {}),
                };
                const labelCell: React.CSSProperties = {
                  ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase',
                  background: isGoldTab ? '#F4BC41' : '#f1f5f9', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151',
                };
                const isMastersTournament = selectedTournament === 'masters';
                const isRedTotalTournament = selectedTournament === 'us-open';
                const subtotalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#BE3436' : '#1e3a5f', color: '#fff', borderLeft: thickBorder,
                };
                const holeHeaderCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12,
                };
                const subtotalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#BE3436' : '#1e3a5f', borderLeft: thickBorder,
                };

                const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;

                // Standard golf scorecard notation applied to each hole score
                const badge = (score: number, par: number): React.CSSProperties => {
                  const base: React.CSSProperties = {
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, boxSizing: 'border-box', fontSize: 13,
                  };
                  if (!score || !par) return base;
                  const diff = score - par;
                  const r = '#dc2626'; // red — under par
                  const k = '#0f1720'; // dark — over par
                  const g = '#fff';    // gap between rings
                  // hole-in-one or eagle → 2 circles (checked before albatross so HIO on par-4 = 2 circles)
                  if (score === 1 || diff === -2)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                  // albatross → 3 circles
                  if (diff <= -3)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                  // birdie → 1 circle
                  if (diff === -1)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                  // bogey → 1 square
                  if (diff === 1)
                    return { ...base, border: `2px solid ${k}` };
                  // double bogey → 2 squares
                  if (diff === 2)
                    return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                  // triple bogey or worse → 3 squares
                  if (diff >= 3)
                    return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k},0 0 0 6px ${g},0 0 0 8px ${k}` };
                  return base; // par — no decoration
                };

                return (
                  <div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                        <thead>
                          <tr>
                            <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                            {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                            <th style={subtotalHeaderCell}>Front</th>
                            {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                            <th style={subtotalHeaderCell}>Back</th>
                            <th style={totalHeaderCell}>TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={labelCell}>Par</td>
                            {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                            <td style={subtotalCell}>{frontPar || '--'}</td>
                            {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                            <td style={subtotalCell}>{backPar || '--'}</td>
                            <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                          </tr>
                          <tr>
                            <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                            {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '5px 5px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                            <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                            {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '5px 5px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                            <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                            <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {rnd.holes.length === 0 && (
                      <div style={{ color: '#607282', fontSize: 14, marginTop: 12 }}>
                        Round {rnd.round} score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score ?? '--'}
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
            </div>
          </div>
        ) : null}

        {showRosterConfirm && (
          <div
            onClick={() => setShowRosterConfirm(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 18px 48px rgba(9,34,51,0.25)' }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720', marginBottom: 6 }}>Confirm Your Roster</div>
              <div style={{ color: '#5b6b79', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                <div>Par = <strong style={{ color: '#0f1720' }}>{TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '—'}</strong></div>
                <div>Your tiebreak value: <strong style={{ color: '#0f1720' }}>{tieBreakInput}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowRosterConfirm(false); void handleSave(); }}
                  style={{ flex: 1, border: 'none', borderRadius: 12, padding: '12px 0', background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowRosterConfirm(false)}
                  style={{ flex: 1, border: '2px solid #dfe5eb', borderRadius: 12, padding: '12px 0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        </>
        ) : null}
      </div>
    </div>
  );
}
