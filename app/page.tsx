'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

// 12pm EST/EDT on the Friday (Round 2) of each tournament
const TOURNAMENT_CUT_SHOW_AT: Partial<Record<TournamentId, string>> = {
  players: '2026-03-13T12:00:00-04:00',
  masters: '2026-04-10T12:00:00-04:00',
  pga: '2026-05-15T12:00:00-04:00',
  'us-open': '2026-06-19T12:00:00-04:00',
  open: '2026-07-17T12:00:00-04:00',
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

const TOURNAMENT_CARD_WIDTH = 148;
const TOURNAMENT_CARD_HEIGHT = 54;

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
type MainTab = 'Standings' | 'My entries' | 'Details' | 'Commissioner console';

type FeedRow = {
  position: string;
  score: string;
  thru: string;
  total?: string;
  currentRoundScore?: string | null;
  canonicalName?: string;
  scoreBreakdown?: GolferScoreBreakdown;
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
  projectedCut?: string | null;
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
  points: number;
  holesRemaining: number;
  scoreBreakdown: GolferScoreBreakdown;
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
    const salary =
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

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:session`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

function writeStoredSession(payload: SessionPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(`${STORAGE_PREFIX}:session`, JSON.stringify(payload));
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

function fieldStyle() {
  return {
    width: '100%',
    borderRadius: 14,
    border: '1px solid #d7e0e8',
    padding: '12px 14px',
    fontSize: 15,
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
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const entryBreakdownRef = useRef<HTMLDivElement>(null);
  const [showPointsSystem, setShowPointsSystem] = useState(false);
  const [selectedLeaderboardPlayerId, setSelectedLeaderboardPlayerId] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
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
  const [commissionerPlayerSearch, setCommissionerPlayerSearch] = useState('');
  const [commissionerMemberModalOpen, setCommissionerMemberModalOpen] = useState(false);
  const [commissionerMemberModalView, setCommissionerMemberModalView] = useState<'menu' | 'displayName' | 'email' | 'confirmDelete'>('menu');
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
  const entriesLocked = pool?.lineupLocks?.[entriesTournamentId] ?? entriesDefaultLocked;
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

    void loadSession();
  }, []);

  useEffect(() => {
    if (sessionUser) {
      writeStoredSession({
        user: sessionUser,
        pool,
        entries: poolEntries,
      });
      return;
    }

    clearStoredSession();
  }, [pool, poolEntries, sessionUser]);

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
    const statuses = getTournamentCardStatuses(new Date(nowTick));
    const inProgress = TOURNAMENTS.find((t) => statuses[t.id]?.label === 'IN PROGRESS');
    if (inProgress) {
      setSelectedTournament(inProgress.id);
    }
  }, [nowTick]);

  useEffect(() => {
    if (mainTab === 'Commissioner console' && !canManagePool) {
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

    const loadFeed = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}`, {
          cache: 'no-store',
        });

        if (active) {
          setFeed(payload);
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
  }, [selectedTournament]);

  useEffect(() => {
    const loadCommissionerMembers = async () => {
      if (!sessionUser || !canManagePool || mainTab !== 'Commissioner console') {
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
  }, [canManagePool, mainTab, sessionUser]);

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
            tieBreak: parseInt(commissionerTieBreakInput, 10),
            tieBreakTournamentId: entriesTournamentId,
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
      buildPricedPlayers(PLAYER_POOL, liveOddsMap).map((player) => {
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
          points: scoreBreakdown.totalPoints,
          holesRemaining: scoreBreakdown.holesRemaining,
          scoreBreakdown,
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
  const filteredEntriesPlayers = players.filter((player) => {
    const query = entriesPlayerSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return player.name.toLowerCase().includes(query);
  });
  const filteredCommissionerPlayers = players.filter((player) => {
    const query = commissionerPlayerSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return player.name.toLowerCase().includes(query);
  });

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
  const locked = pool?.lineupLocks?.[selectedTournament] ?? defaultLocked;
  const showFinalTournamentView = selectedTournamentStatus?.label === 'LOCKED';
  const showProjectedCut = (() => {
    const showAt = TOURNAMENT_CUT_SHOW_AT[selectedTournament];
    return showAt ? Date.now() >= new Date(showAt).getTime() : false;
  })();
  const showFutureTournamentView =
    selectedTournamentStatus?.label === 'UP NEXT' ||
    selectedTournamentStatus?.label === 'ACTIVE' ||
    selectedTournamentStatus === null;
  const showLivePayoutStrip =
    selectedTournamentStatus?.label === 'IN PROGRESS' || selectedTournamentStatus?.label === 'LOCKED';
  const displayTournamentWindow = getDisplayTournamentWindow(tournament, new Date(nowTick));
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
  ).map((entry) =>
    entry.name === COMMISSIONER_DISPLAY_NAME && selectedTournament === 'masters'
      ? {
          ...entry,
          rosters: {
            ...entry.rosters,
            masters: DEFAULT_ROSTERS.masters,
          },
        }
      : entry,
  );

  const standings: StandingEntry[] = liveStandingEntries
    .map((entry) => {
      const savedRoster = entry.rosters[selectedTournament];
      const picks =
        savedRoster && savedRoster.length > 0
          ? savedRoster
          : entry.name === COMMISSIONER_DISPLAY_NAME
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
    tieBreakValid &&
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

  const handleMainTabChange = (tab: MainTab) => {
    setAccountMenuOpen(false);
    setMyEntriesMenuOpen(false);
    setActiveStandingEntryId(null);
    setActiveStandingGolferId(null);
    setCommissionerMemberModalOpen(false);

    if (tab === 'Standings') {
      setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date())));
      setSelectedLeaderboardPlayerId(null);
      setCommissionerConsoleView('dashboard');
      setCommissionerRosterMemberId(null);
      setCommissionerMemberSearch('');
      setShowAddMemberForm(false);
      setMyEntriesEditorOpen(false);
      setMyEntriesDetailView('none');
    } else if (tab === 'My entries') {
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
    } else if (tab === 'Commissioner console') {
      setMyEntriesEditorOpen(false);
      setMyEntriesDetailView('none');
      setSaveMessage('');
      setSelectedLeaderboardPlayerId(null);
      setCommissionerConsoleView('dashboard');
      setCommissionerRosterMemberId(null);
      setCommissionerMemberSearch('');
      setShowAddMemberForm(false);
    }

    setMainTab(tab);
  };

  const openMyEntriesEditor = () => {
    setSaveMessage('');
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSelectedRoster(savedRoster.length > 0 ? savedRoster : []);
    const savedTieBreak = sessionUser?.tieBreaks?.[entriesTournamentId];
    setTieBreakInput(savedTieBreak != null ? String(savedTieBreak) : '');
    setMyEntriesEditorOpen(true);
    handleMainTabChange('My entries');
    setMyEntriesEditorOpen(true);
  };

  const closeMyEntriesEditor = () => {
    setMyEntriesEditorOpen(false);
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSaveMessage('');
  };

  const renderRosterCards = (background: string, allowRemove = false) => (
    <div style={{ display: 'grid', gap: 10 }}>
      {orderedRosterPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #e6edf1',
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={player.photoUrl ?? pgaPhoto(player.pgaTourId)}
              alt={player.name}
              className="roster-card-photo" style={{ width: 58, height: 58, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#e8eef4' }}
            />
            <div>
              <div style={{ fontWeight: 700 }}>{player.name}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
                OWGR {player.worldRank} | {player.odds} | <span style={{ fontWeight: 800, fontSize: 15, color: '#3f73ad' }}>${player.salary.toLocaleString()}</span>
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>{player.points}</div>
              <div style={{ fontSize: 12, color: '#2f5f96' }}>{player.holesRemaining} holes left</div>
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

  return (
    <div
      style={{
        minHeight: '100vh',
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
            padding: isMobile ? (sessionUser ? '8px 12px 4px' : '10px 12px') : (sessionUser ? '10px 28px 6px' : '10px 28px'),
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

          {sessionUser ? (
            <div
              style={{
                marginTop: 6,
                paddingTop: 8,
                borderTop: '1px solid rgba(112, 202, 220, 0.18)',
                display: 'flex',
                justifyContent: isMobile ? 'flex-start' : 'center',
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
              {(['Standings', 'My entries', 'Details', 'Commissioner console'] as MainTab[])
                .filter((tab) => tab !== 'Commissioner console' || canManagePool)
                .map((tab) => {
                  const active = tab === mainTab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleMainTabChange(tab)}
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

          {sessionUser ? (
            <div style={{ position: 'absolute', right: isMobile ? 10 : 22, bottom: isMobile ? 62 : 6, zIndex: 30 }}>
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
                  width: 42,
                  height: 42,
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
                <CircleUserRound size={20} />
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
              marginTop: 24,
              display: 'flex',
              overflowX: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 6,
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
              {TOURNAMENTS.map((item) => {
                const active = item.id === selectedTournament;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedTournament(item.id)}
                    style={{
                      border: active ? '1px solid #d7e0e8' : '1px solid transparent',
                      borderBottom: active ? '1px solid #fff' : '1px solid transparent',
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
                    }}
                  >
                    {TOURNAMENT_TAB_LOGOS[item.id] ? (
                      <img
                        src={TOURNAMENT_TAB_LOGOS[item.id]}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          width: '100%',
                          height: isMobile ? 28 : (TOURNAMENT_TAB_LOGO_HEIGHTS[item.id] ?? 40),
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
              marginTop: 24,
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
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  {selectedTournament === 'players' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 30, fontWeight: 800, color: '#0f1720' }}>
                        The Players Championship
                      </h2>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                          marginTop: 8,
                          color: '#5b6b79',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: isMobile ? 13 : 18, fontWeight: 500 }}>TPC Sawgrass</span>
                        <span style={{ fontSize: isMobile ? 12 : 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.players}</span>
                      </div>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ marginTop: 4, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: '#2f5f96' }}>
                          Projected Cut: {feed.projectedCut}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'masters' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 30, fontWeight: 800, color: '#0f1720' }}>
                        The Masters
                      </h2>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                          marginTop: 8,
                          color: '#5b6b79',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: isMobile ? 13 : 18, fontWeight: 500 }}>Augusta National Golf Club</span>
                        <span style={{ fontSize: isMobile ? 12 : 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.masters}</span>
                      </div>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ marginTop: 4, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: '#2f5f96' }}>
                          Projected Cut: {feed.projectedCut}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'pga' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 30, fontWeight: 800, color: '#0f1720' }}>
                        PGA Championship
                      </h2>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                          marginTop: 8,
                          color: '#5b6b79',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: isMobile ? 13 : 18, fontWeight: 500 }}>Aronimink Golf Club</span>
                        <span style={{ fontSize: isMobile ? 12 : 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.pga}</span>
                      </div>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ marginTop: 4, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: '#2f5f96' }}>
                          Projected Cut: {feed.projectedCut}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'us-open' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 30, fontWeight: 800, color: '#0f1720' }}>
                        U.S. Open
                      </h2>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                          marginTop: 8,
                          color: '#5b6b79',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: isMobile ? 13 : 18, fontWeight: 500 }}>Shinnecock Hills Golf Club</span>
                        <span style={{ fontSize: isMobile ? 12 : 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS['us-open']}</span>
                      </div>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ marginTop: 4, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: '#2f5f96' }}>
                          Projected Cut: {feed.projectedCut}
                        </div>
                      ) : null}
                    </>
                  ) : selectedTournament === 'open' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 30, fontWeight: 800, color: '#0f1720' }}>
                        The Open Championship
                      </h2>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                          marginTop: 8,
                          color: '#5b6b79',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: isMobile ? 13 : 18, fontWeight: 500 }}>Royal Birkdale Golf Club</span>
                        <span style={{ fontSize: isMobile ? 12 : 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.open}</span>
                      </div>
                      {showProjectedCut && feed?.projectedCut ? (
                        <div style={{ marginTop: 4, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: '#2f5f96' }}>
                          Projected Cut: {feed.projectedCut}
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
                {!(showFutureTournamentView && !picksOpenForTournament) && !showFinalTournamentView ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5b6b79', fontSize: 14 }}>
                    <RefreshCw size={15} />
                    <span>
                      {showFutureTournamentView
                        ? 'Pool is open for lineup building'
                        : isLoading
                          ? 'Refreshing live scores...'
                          : formatRefresh(feed?.fetchedAt ?? null)}
                    </span>
                  </div>
                ) : null}
              </div>

              {!showFinalTournamentView ? (
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  {showLivePayoutStrip ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div
                        style={{
                          borderRadius: 999,
                          background: '#eef4ff',
                          color: '#2f5f96',
                          padding: '6px 10px',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        1st: {formatPayoutAmount(selectedTournamentPayouts?.first)}
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          background: '#eef4ff',
                          color: '#2f5f96',
                          padding: '6px 10px',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        2nd: {formatPayoutAmount(selectedTournamentPayouts?.second)}
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          background: '#eef4ff',
                          color: '#2f5f96',
                          padding: '6px 10px',
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        3rd: {formatPayoutAmount(selectedTournamentPayouts?.third)}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
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
                          <a
                            href="venmo://paycharge?txn=pay&recipients=claytont743&amount=30&note=Golf%20Majors%20Pool"
                            style={{ color: '#3d95ce', textDecoration: 'none', fontWeight: 600 }}
                          >
                            @claytont743
                          </a>
                        ) : '@claytont743'}
                      </span>
                    </div>
                  )}
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
                      minHeight: isMobile ? 80 : 180,
                    }}
                  >
                    {TOURNAMENT_CARD_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_CARD_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: isMobile ? 90 : 180,
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
                        ? 'The field has been finalized and picks are now open in the pool. Build your lineup before the first tee time on Thursday morning.'
                        : 'Picks can not be entered until the tournament field has been finalized and entered in our system (usually Monday morning the week of the tournament).'}
                    </div>

                    {picksOpenForTournament && selectedTournament === entriesTournamentId && sessionUser ? (
                      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <button
                          onClick={openMyEntriesEditor}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: '14px 22px',
                            background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                            color: '#fff',
                            fontSize: 16,
                            fontWeight: 900,
                            cursor: 'pointer',
                            boxShadow: '0 14px 28px rgba(63, 115, 173, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Pencil size={16} />
                          {hasSubmittedRoster ? 'Edit Picks' : 'Make Your Picks'}
                        </button>
                        <div style={{ color: '#5b6b79', fontSize: 14, fontWeight: 600 }}>
                          Members with submitted picks:{' '}
                          <span style={{ color: '#0f1720', fontWeight: 900 }}>{submittedEntries.length}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : showFinalTournamentView ? (
                <div style={{ marginTop: isMobile ? 14 : 28, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#5b6b79', fontSize: isMobile ? 10 : 12 }}>
                        <th style={{ padding: isMobile ? '0 8px 8px 0' : '0 18px 14px 0' }}>Rank</th>
                        <th style={{ padding: isMobile ? '0 8px 8px 0' : '0 18px 14px 0' }}>Entry</th>
                        <th style={{ padding: isMobile ? '0 8px 8px 0' : '0 18px 14px 0', textAlign: 'center' }}>Roster Points</th>
                        <th style={{ padding: isMobile ? '0 8px 8px 0' : '0 18px 14px 0', textAlign: 'center' }}>Holes Remaining</th>
                        <th style={{ padding: isMobile ? '0 0 8px' : '0 0 14px', textAlign: 'center' }}>Tie-break</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                          }}
                          style={{
                            borderTop: '1px solid #e7edf2',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? '#eef4ff'
                                : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 0' : '16px 18px 16px 0', fontSize: isMobile ? 12 : 16 }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 0' : '16px 18px 16px 0' }}>
                            <div
                              style={{
                                fontSize: isMobile ? 13 : 18,
                                color: '#0f1720',
                                textAlign: 'left',
                              }}
                            >
                              {entry.name}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 0' : '16px 18px 16px 0', textAlign: 'center', fontSize: isMobile ? 12 : 18 }}>
                            {entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 0' : '16px 18px 16px 0', textAlign: 'center', fontSize: isMobile ? 12 : 18 }}>
                            {entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 0' : '16px 0', textAlign: 'center', fontSize: isMobile ? 12 : 18 }}>{entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <div style={{ marginTop: isMobile ? 10 : 18, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#5b6b79', fontSize: isMobile ? 10 : 12, textTransform: 'uppercase' }}>
                          <th style={{ padding: isMobile ? '0 0 8px' : '0 0 12px' }}>Place</th>
                          <th style={{ padding: isMobile ? '0 0 8px' : '0 0 12px' }}>Entry</th>
                          <th style={{ padding: isMobile ? '0 0 8px' : '0 0 12px' }}>Roster points</th>
                          <th style={{ padding: isMobile ? '0 0 8px' : '0 0 12px' }}>Holes left</th>
                          <th style={{ padding: isMobile ? '0 0 8px' : '0 0 12px' }}>Tie-break</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((entry) => (
                          <tr
                            key={entry.id}
                            onClick={() => {
                              setActiveStandingGolferId(null);
                              setActiveStandingEntryId(entry.id);
                            }}
                            style={{ borderTop: '1px solid #edf1f4', cursor: 'pointer' }}
                          >
                            <td style={{ padding: isMobile ? '10px 0' : '16px 0', fontWeight: 800, color: '#2f5f96', fontSize: isMobile ? 12 : 14 }}>#{entry.place}</td>
                            <td style={{ padding: isMobile ? '10px 0' : '16px 0' }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: '#0f1720',
                                  textAlign: 'left',
                                  fontSize: isMobile ? 13 : 18,
                                }}
                              >
                                {entry.name}
                              </div>
                              <div style={{ marginTop: 4, fontSize: isMobile ? 11 : 13, color: '#6b7b88' }}>
                                {entry.golfers.map((golfer) => golfer.name.split(' ')[0]).join(', ') || 'No lineup saved'}
                              </div>
                            </td>
                            <td style={{ padding: isMobile ? '10px 0' : '16px 0', fontWeight: 900, fontSize: isMobile ? 12 : 18 }}>{entry.rosterPoints}</td>
                            <td style={{ padding: isMobile ? '10px 0' : '16px 0', fontWeight: 700, fontSize: isMobile ? 12 : 14 }}>{entry.holesRemaining}</td>
                            <td style={{ padding: isMobile ? '10px 0' : '16px 0', fontWeight: 700, color: '#2f5f96', fontSize: isMobile ? 12 : 14 }}>{entry.tieBreakValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      borderRadius: 18,
                      background: '#f5f9fb',
                      padding: 16,
                      color: '#50616f',
                      lineHeight: 1.5,
                    }}
                  >
                    Live scoring is now points-first. Hole-by-hole categories, streaks, round bonuses, and final finish
                    bonuses are scaffolded for the upcoming Slash Golf integration.
                </div>
              </>
            )}
            </section>

            <aside style={{ display: showFutureTournamentView ? 'none' : 'grid', gap: 20 }}>
              {showFinalTournamentView ? (
                <section
                  style={{
                    background: '#fff',
                    borderRadius: 20,
                    padding: isMobile ? 14 : 22,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 30, color: '#0f1720', textAlign: isMobile ? 'center' : 'left', fontWeight: 'bold', width: isMobile ? '100%' : undefined }}>{tournament.name} Leaderboard</h3>
                  </div>
                  <div style={{ marginTop: isMobile ? 12 : 24, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 14 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', fontSize: isMobile ? 10 : 12, color: '#5b6b79' }}>
                          <th style={{ padding: isMobile ? '6px 4px' : '10px 8px', border: '1px solid #d7dee6', textAlign: 'center' }}>Pos.</th>
                          <th style={{ padding: isMobile ? '6px 4px' : '10px 8px', border: '1px solid #d7dee6' }}>Player</th>
                          <th style={{ padding: isMobile ? '6px 4px' : '10px 8px', border: '1px solid #d7dee6', textAlign: 'center' }}>Total</th>
                          <th style={{ padding: isMobile ? '6px 4px' : '10px 8px', border: '1px solid #d7dee6', textAlign: 'center' }}>Thru</th>
                          <th style={{ padding: isMobile ? '6px 4px' : '10px 8px', border: '1px solid #d7dee6', textAlign: 'center' }}>Picked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventLeaderboardRows.map((player) => {
                          const timesPicked = standings.reduce(
                            (sum, entry) => sum + entry.golfers.filter((golfer) => golfer.id === player.id).length,
                            0,
                          );
                          const activePlayer = selectedLeaderboardPlayerId === player.id;

                          return (
                            <tr
                              key={player.id}
                              onClick={() => setSelectedLeaderboardPlayerId(activePlayer ? null : player.id)}
                              style={{
                                borderTop: '1px solid #e7edf2',
                                background: activePlayer ? '#eef4ff' : 'transparent',
                                cursor: 'pointer',
                              }}
                            >
                              <td style={{ padding: isMobile ? '5px 4px' : '8px', border: '1px solid #e7edf2', textAlign: 'center' }}>{formatLeaderboardPosition(player.position)}</td>
                              <td style={{ padding: isMobile ? '5px 4px' : '8px', border: '1px solid #e7edf2', fontWeight: activePlayer ? 800 : 400 }}>{player.name}</td>
                              <td style={{ padding: isMobile ? '5px 4px' : '8px', border: '1px solid #e7edf2', textAlign: 'center' }}>{player.score}</td>
                              <td style={{ padding: isMobile ? '5px 4px' : '8px', border: '1px solid #e7edf2', textAlign: 'center' }}>{player.thru}</td>
                              <td style={{ padding: isMobile ? '5px 4px' : '8px', border: '1px solid #e7edf2', textAlign: 'center' }}>
                                {timesPicked}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {!showFinalTournamentView ? (
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
                  onClick={handleSave}
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
                  <Save size={16} />
                  {sessionUser ? 'Save lineup' : 'Sign in to save'}
                </button>
              </section>
              ) : null}

              {!showFinalTournamentView ? (
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

        {mainTab === 'My entries' && (
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
                  Make your picks for each entry below. You can submit or modify your picks up until the first tee time of Round 1.
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
                    gridTemplateColumns: isMobile ? 'auto 1fr auto' : 'minmax(220px, 1fr) minmax(320px, 420px) minmax(220px, 1fr)',
                    gap: isMobile ? '6px 8px' : 20,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720' }}>Entry</div>
                  <div
                    style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'center', justifySelf: 'center' }}
                  >
                    {entriesTournamentId === 'pga' ? 'PGA Championship Picks' : `${entriesTournament.name} Picks`}
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'right' }}>Options</div>

                  <div style={{ fontSize: isMobile ? 12 : 18, color: '#0f1720', fontWeight: isMobile ? 600 : 400 }}>{userLabel}</div>
                  <div style={{ display: 'grid', justifyItems: 'center' }}>
                    {hasSubmittedRoster ? (
                      <div
                        style={{
                          borderRadius: 12,
                          border: '1px solid #dce6ee',
                          background: '#f8fbfd',
                          padding: isMobile ? '8px 10px' : '12px 14px',
                          display: 'grid',
                          gap: isMobile ? 6 : 10,
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {savedRosterPlayers.map((player) => (
                            <span
                              key={player.id}
                              style={{
                                borderRadius: 999,
                                background: '#e8f3ff',
                                color: '#2f5f96',
                                padding: isMobile ? '4px 8px' : '7px 12px',
                                fontSize: isMobile ? 11 : 13,
                                fontWeight: 800,
                              }}
                            >
                              {player.name}
                            </span>
                          ))}
                        </div>
                        <div style={{ color: '#5b6b79', fontSize: isMobile ? 11 : 13 }}>
                          Roster submitted for {entriesTournament.name}. You can reopen it with <strong>Edit Picks</strong>{' '}
                          while lineups are unlocked.
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={openMyEntriesEditor}
                        style={{
                          border: 'none',
                          borderRadius: 12,
                          padding: isMobile ? '8px 12px' : '12px 18px',
                          background: '#7ee5e6',
                          color: '#0f1720',
                          fontSize: isMobile ? 12 : 15,
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Pencil size={12} />
                        Make Your Picks
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
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            openMyEntriesEditor();
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
                          <Pencil size={15} />
                          <span>{hasSubmittedRoster ? 'Edit Picks' : 'Make Your Picks'}</span>
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
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{event.name}</div>
                            {historyPlayers.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {historyPlayers.map((player) => (
                                  <span
                                    key={`history-player-${event.id}-${player.id}`}
                                    style={{
                                      borderRadius: 999,
                                      background: '#e8f3ff',
                                      color: '#2f5f96',
                                      padding: '7px 12px',
                                      fontSize: 13,
                                      fontWeight: 800,
                                    }}
                                  >
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

                    <div style={{ fontSize: isMobile ? 18 : 30, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ display: 'grid', gap: 14 }}>
                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => (
                        <div
                          key={`placeholder-slot-${index + 1}`}
                          style={{
                            borderRadius: 14,
                            border: '1px solid #d7e0e8',
                            background: '#fff',
                            padding: isMobile ? '10px 12px' : '16px 18px',
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 13 : 18, color: '#556572' }}>Golfer #{index + 1}</div>
                        </div>
                      ))}
                    </div>

                    <input
                      value={tieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setTieBreakInput(val);
                      }}
                      placeholder="Enter tiebreak value*"
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
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                      Pick Sheet
                    </div>
                    <h2 style={{ margin: '6px 0 0', fontSize: isMobile ? 18 : 30, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 20,
                  }}
                >
                  <div style={{ display: 'grid', gap: 18 }}>
                    <section
                      style={{
                        background: '#fff',
                        borderRadius: 20,
                        padding: 18,
                        border: '1px solid #e6edf1',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Trophy size={18} color="#2f5f96" />
                            <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 900 }}>
                              {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name}
                            </div>
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
                            <span style={{ fontSize: isMobile ? 12 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 11 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        <label
                          style={{
                            minWidth: 280,
                            maxWidth: 320,
                            width: '100%',
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
                              padding: '12px 0',
                              fontSize: isMobile ? 16 : 15,
                              background: 'transparent',
                            }}
                          />
                        </label>
                      </div>

                      <div>
                        <div style={{ display: 'grid', gap: 10 }}>
                        {filteredEntriesPlayers.map((player) => {
                          const selected = selectedRoster.includes(player.id);
                          const disabled =
                            !selected &&
                            (entriesLocked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                          return (
                            <div
                              key={player.id}
                              style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: disabled ? 0.58 : 1 }}
                            >
                              <button
                                onClick={() => togglePlayer(player.id)}
                                style={{
                                  flex: 1,
                                  textAlign: 'left',
                                  borderRadius: 16,
                                  border: selected
                                    ? '2px solid #3f73ad'
                                    : disabled
                                      ? '1px solid #d7dee6'
                                      : '1px solid #e6edf1',
                                  background: selected ? '#eef4ff' : disabled ? '#f3f5f7' : '#fff',
                                  padding: 14,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                }}
                                disabled={disabled}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                  <div>
                                    <div className="picksheet-player-name" style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>
                                      {player.name}
                                    </div>
                                    <div className="picksheet-player-subtext" style={{ marginTop: 4, color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 13 }}>
                                      OWGR: {player.worldRank} | {player.odds}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
                                    <div className="picksheet-player-salary-right" style={{ color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 12 }}>
                                      ${player.salary.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </section>
                  </div>

                  <div
                    style={{
                      background: '#f8fbfd',
                      border: '1px solid #e6edf1',
                      borderRadius: 20,
                      padding: 18,
                    }}
                  >
                    {renderRosterCards('#fff', true)}
                    {renderBudgetCards('#fff', '1px solid #e6edf1')}

                    <input
                      value={tieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setTieBreakInput(val);
                      }}
                      placeholder="Enter tiebreak value*"
                      inputMode="numeric"
                      maxLength={3}
                      style={{
                        ...fieldStyle(),
                        marginTop: 14,
                      }}
                    />

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
                      onClick={handleSave}
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
                      <Save size={16} />
                      Save lineup
                    </button>
                    <div style={{ color: '#5b6b79', fontSize: 13, lineHeight: 1.65, marginTop: 8 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                      Use their total strokes, NOT score to par. Example: Enter 274 (NOT -14)
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
                  Venmo: @claytont743
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 4 }}>🟢</span>
                  <span style={{ marginRight: 4 }}>➤</span>
                  <span style={{ color: '#dc2626', fontWeight: 800, fontSize: isMobile ? 14 : 20, marginRight: 4 }}>?</span>
                  <span style={{ marginRight: 8 }}>:</span>
                  <span>Clayton Tucker</span>
                  <span style={{ margin: '0 3px 0 6px' }}>📞</span>
                  <span>(325.665.8299)</span>
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

        {mainTab === 'Commissioner console' && (
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
                Commissioner console
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
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>Slash Golf API</div>
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
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: isMobile ? 10 : 20,
                }}
              >
                <div
                  style={{
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
                    onClick={() => setCommissionerConsoleView('dashboard')}
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
                    style={{ ...fieldStyle(), border: 'none', outline: 'none', padding: 0, fontSize: isMobile ? 12 : 15 }}
                  />
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
                        <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, color: '#0f1720' }}>
                          {commissionerTournamentLabel}
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
                      </label>
                    </div>

                    <div style={{ padding: isMobile ? 12 : 20, maxHeight: 960, overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gap: isMobile ? 8 : 12 }}>
                      {filteredCommissionerPlayers.map((player) => {
                        const isSelected = commissionerRosterSelection.includes(player.id);
                        const isDisabled =
                          !isSelected &&
                          (commissionerRosterSelection.length >= REQUIRED_GOLFERS || player.salary > commissionerSalaryRemaining);

                        return (
                          <div
                            key={`commissioner-player-${player.id}`}
                            style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: isDisabled ? 0.45 : 1 }}
                          >
                            <div
                              style={{
                                flex: 1,
                                border: isSelected ? '2px solid #3f73ad' : '1px solid #d7e0e8',
                                borderRadius: isMobile ? 14 : 18,
                                background: isSelected ? '#eef4ff' : '#fff',
                                padding: isMobile ? 10 : 16,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 10 : 16, alignItems: 'center' }}>
                                <button
                                  onClick={() => toggleCommissionerRosterPlayer(player.id)}
                                  disabled={isDisabled}
                                  style={{
                                    fontSize: isMobile ? 20 : 28,
                                    fontWeight: 900,
                                    color: '#0f1720',
                                    minWidth: 20,
                                    background: 'none',
                                    border: 'none',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    padding: 0,
                                    lineHeight: 1,
                                    flexShrink: 0,
                                  }}
                                >
                                  {isSelected ? '−' : '+'}
                                </button>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 900, color: '#0f1720' }}>{player.name}</div>
                                  <div style={{ marginTop: 4, fontSize: isMobile ? 11 : 14, color: '#607282' }}>
                                    OWGR: {player.worldRank} | {player.odds}
                                  </div>
                                </div>
                                <div style={{ fontSize: isMobile ? 13 : 20, fontWeight: 800, color: '#607282' }}>${player.salary.toLocaleString()}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={{ border: '1px solid #d7e0e8', borderRadius: 18, padding: isMobile ? 16 : 26, background: '#fff' }}>
                    <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                    <div style={{ marginTop: 4, fontSize: isMobile ? 30 : 40, fontWeight: 900, color: '#1f8d4e' }}>${commissionerSalaryRemaining.toLocaleString()}</div>
                    <div style={{ marginTop: 8, fontSize: isMobile ? 12 : 16, color: '#31424f' }}>
                      Avg Rem./Player: ${commissionerAverageRemainingPerPlayer.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                    <div style={{ fontSize: isMobile ? 18 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                      const golfer = commissionerOrderedRosterPlayers[index];
                      return (
                        <div
                          key={`commissioner-roster-slot-${index}`}
                          style={{
                            border: '1px solid #d7e0e8',
                            borderRadius: isMobile ? 14 : 18,
                            background: '#fff',
                            minHeight: isMobile ? 60 : 74,
                          }}
                        >
                          <div style={{ padding: isMobile ? '12px 14px' : '16px 20px', display: 'grid', alignContent: 'center', gap: 4 }}>
                            {golfer ? (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10 }}>
                                  <img
                                    src={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)}
                                    alt={golfer.name}
                                    className="roster-card-photo" style={{ width: isMobile ? 46 : 58, height: isMobile ? 46 : 58, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#e8eef4' }}
                                  />
                                  <div>
                                    <div style={{ fontSize: isMobile ? 13 : 20, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                                    <div style={{ fontSize: isMobile ? 11 : 14, color: '#607282' }}>OWGR {golfer.worldRank} | {golfer.odds} | <span style={{ fontWeight: 800, fontSize: isMobile ? 12 : 16, color: '#3f73ad' }}>${golfer.salary.toLocaleString()}</span></div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleCommissionerRosterPlayer(golfer.id)}
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
                              </div>
                            ) : (
                              <div style={{ fontSize: isMobile ? 13 : 18, color: '#50616f' }}>GOLFER {index + 1}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <input
                      value={commissionerTieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setCommissionerTieBreakInput(val);
                      }}
                      placeholder="Enter tiebreak value*"
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
                        background: canSaveCommissionerRoster ? '#e7ebef' : '#f2f4f6',
                        color: canSaveCommissionerRoster ? '#0f1720' : '#98a3ad',
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
              className="breakdown-modal"
              style={{
                width: 'min(620px, 100%)',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto',
                background: '#fff',
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
                  <div style={{ marginTop: 2, color: '#6b7b88', fontSize: isMobile ? 10.5 : 12 }}>
                    {isMobile
                      ? '*Tap player for details; Tap "Current Rnd" for scorecard'
                      : '*Click player for scoring details; Click "Current Rnd" for scorecard'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPointsSystem(false);
                    setActiveStandingGolferId(null);
                    setActiveStandingEntryId(null);
                  }}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    padding: '8px 14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ marginTop: isMobile ? 12 : 6, display: 'grid', gap: isMobile ? 8 : 5 }}>
                {activeStandingEntry.golfers.length > 0 ? (
                  activeStandingGolfers.map((golfer, index) => {
                    const pickedCount = standings.reduce(
                      (sum, entry) => sum + entry.golfers.filter((entryGolfer) => entryGolfer.id === golfer.id).length,
                      0,
                    );
                    const isActiveGolfer = activeStandingGolferId === golfer.id;

                    return (
                    <button
                      key={golfer.id}
                      onClick={() => setActiveStandingGolferId(golfer.id)}
                      style={{
                        width: '100%',
                        border: '1px solid #e6edf1',
                        borderRadius: 12,
                        padding: isMobile ? '10px 12px' : '7px 12px',
                        background: isActiveGolfer ? '#eef4ff' : '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <img
                          src={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)}
                          alt={golfer.name}
                          className="breakdown-golfer-photo"
                          style={{ width: isMobile ? 52 : 42, height: isMobile ? 52 : 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#e6edf1' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="breakdown-golfer-name" style={{ fontSize: isMobile ? 16 : 14, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                          <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#6b7b88', fontSize: isMobile ? 12 : 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span>Holes Rem: {golfer.holesRemaining}</span>
                            <span>Picked: {pickedCount}</span>
                            <span>Pos: {formatPosition(golfer.position)}</span>
                          </div>
                          {golfer.score === 'CUT' || golfer.score === 'MDF' ? (
                            <div className="breakdown-golfer-subtext" style={{ marginTop: 2, fontSize: isMobile ? 12 : 11, fontWeight: 800, color: '#cc2944' }}>MISSED CUT</div>
                          ) : (
                            <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: '#50616f', fontSize: isMobile ? 12 : 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <span>Score: {golfer.score}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScorecardGolferName(golfer.name);
                                  setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                  setScorecardData(null);
                                  setScorecardLoading(true);
                                  fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}`)
                                    .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                }}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#2f5f96', fontWeight: 700, fontSize: 'inherit', textDecoration: 'underline' }}
                              >
                                Current Rnd: {formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                          <div className="breakdown-golfer-points" style={{ fontSize: isMobile ? 22 : 18, fontWeight: 900, color: '#2f5f96' }}>{formatPointValue(golfer.points)}</div>
                        </div>
                      </div>
                    </button>
                  )})
                ) : (
                  <div
                    style={{
                      borderRadius: 18,
                      border: '1px solid #e6edf1',
                      background: '#f8fbfd',
                      padding: 18,
                      color: '#50616f',
                    }}
                  >
                    No lineup has been saved for this team yet.
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: isMobile ? 18 : 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 16,
                  alignItems: 'center',
                  borderTop: '1px solid #e6edf1',
                  paddingTop: isMobile ? 16 : 10,
                }}
              >
                <div style={{ color: '#50616f', fontSize: isMobile ? 18 : 15 }}>
                  Total holes rem: <strong>{activeStandingEntry.holesRemaining}</strong>
                </div>
                <div style={{ color: '#50616f', fontSize: isMobile ? 18 : 15 }}>
                  Tiebreak value: <strong>{activeStandingEntry.tieBreakValue}</strong>
                </div>
                <div style={{ fontSize: isMobile ? 18 : 15, fontWeight: 800, color: '#0f1720' }}>
                  Total {formatPointValue(activeStandingEntry.rosterPoints)}
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
              className="breakdown-modal"
              style={{
                width: 'min(620px, 100%)',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 20,
                padding: 16,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <img
                    src={activeStandingGolfer.photoUrl ?? pgaPhoto(activeStandingGolfer.pgaTourId)}
                    alt={activeStandingGolfer.name}
                    className="breakdown-scoring-photo"
                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#e6edf1' }}
                  />
                  <div>
                  <div style={{ marginTop: 4 }}>
                    <h3 className="breakdown-scoring-name" style={{ margin: '0 0 6px', fontSize: 20, color: '#0f1720' }}>{activeStandingGolfer.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                      <div
                        style={{
                          borderRadius: 999,
                          background: '#eef4ff',
                          border: '1px solid #c7d8ee',
                          padding: '3px 8px',
                          fontSize: 13,
                          fontWeight: 900,
                          color: '#2f5f96',
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
                          color: '#2f5f96',
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
                  }}
                >
                  Back
                </button>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
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
                  ['Cut Players', activeStandingGolfer.scoreBreakdown.madeCut === false ? 1 : 0, activeStandingGolfer.scoreBreakdown.cutPenaltyPoints],
                ]
                  .filter(([, count]) => Number(count) > 0)
                  .concat([['Leaderboard Place', activeStandingGolfer.position, activeStandingGolfer.scoreBreakdown.placementPoints] as const])
                  .map(([label, count, points]) => (
                  <div
                    key={String(label)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1.3fr) minmax(100px, 0.7fr) minmax(80px, 0.7fr)',
                      gap: 8,
                      alignItems: 'center',
                      border: '1px solid #e6edf1',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f1720' }}>{label}</div>
                    <div style={{ color: '#6b7b88', fontSize: 12 }}>
                      {label === 'Leaderboard Place'
                        ? `Position: ${ordinal(String(count))}`
                        : ['Tourn Low Rnd', 'Rnd 1 Leader', 'Rnd 2 Leader', 'Rnd 3 Leader', 'Cut Players'].includes(String(label))
                        ? ''
                        : `Count: ${String(count)}`}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: Number(points) < 0 ? '#cc2944' : '#2f5f96' }}>
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
                width: 'min(620px, 100%)',
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
            onClick={() => { setScorecardGolferName(null); setScorecardData(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.25)' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={scorecardGolferPhoto ? (scorecardGolferPhoto.photoUrl ?? pgaPhoto(scorecardGolferPhoto.pgaTourId)) : ''}
                    alt={scorecardGolferName}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', background: '#e6edf1', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79', letterSpacing: '0.05em' }}>Scorecard</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>{scorecardGolferName}</div>
                    {scorecardData && (
                      <div style={{ fontSize: 13, color: '#607282', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span>{scorecardData.courseName}</span>
                        <span style={{ fontSize: 11, fontStyle: 'italic' }}>Par: {scorecardData.par}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setScorecardGolferName(null); setScorecardData(null); }}
                  style={{ border: '1px solid #d7e0e8', borderRadius: 999, background: '#fff', padding: '8px 14px', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                >
                  Close
                </button>
              </div>

              {/* Body */}
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
                const frontScore  = front.reduce((s, h) => s + (h.score ?? 0), 0);
                const backScore   = back.reduce((s,  h) => s + (h.score ?? 0), 0);
                const totalScore  = frontScore + backScore;

                const border = '1px solid #d1d9e0';
                const thickBorder = '2px solid #9ab0c4';

                const baseCell: React.CSSProperties = {
                  border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap',
                };
                const labelCell: React.CSSProperties = {
                  ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase',
                  background: '#f1f5f9', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151',
                };
                const subtotalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 800, background: '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 900, background: '#1e3a5f', color: '#fff', borderLeft: thickBorder,
                };
                const holeHeaderCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12,
                };
                const subtotalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: '#1e3a5f', borderLeft: thickBorder,
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
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#2f5f96', marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      Round {rnd.round}
                      {rnd.score != null && rnd.score !== '' && (
                        <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 12 }}>Score: {rnd.score}</span>
                      )}
                    </div>
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
                            <td style={{ ...labelCell, background: '#fff' }}>Score</td>
                            {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '5px 5px' }}><span style={badge(h.score ?? 0, h.par)}>{h.label}</span></td>)}
                            <td style={subtotalCell}>{frontScore > 0 ? frontScore : '--'}</td>
                            {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '5px 5px' }}><span style={badge(h.score ?? 0, h.par)}>{h.label}</span></td>)}
                            <td style={subtotalCell}>{backScore > 0 ? backScore : '--'}</td>
                            <td style={totalCell}>{totalScore > 0 ? totalScore : '--'}</td>
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
        ) : null}

        </>
        ) : null}
      </div>
    </div>
  );
}
