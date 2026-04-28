'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertCircle,
  CircleUserRound,
  CheckCircle2,
  History,
  Lock,
  LogIn,
  MoreVertical,
  Pencil,
  RefreshCw,
  Save,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  buildPlaceholderScoreBreakdown,
  type GolferScoreBreakdown,
} from './lib/scoring';

const SALARY_CAP = 50000;
const REQUIRED_GOLFERS = 6;
const STORAGE_PREFIX = 'golf-pool-live';
const SALARY_MIN = 5000;
const SALARY_MAX = 10800;
const VEGAS_WEIGHT = 0.65;
const WORLD_RANK_WEIGHT = 0.35;
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
  pga: '/pga-of-america-logo.png',
  'us-open': '/us-open-logo.png',
  open: '/the-open-logo.png',
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

const PLAYER_POOL = [
  { id: 1, name: 'Scottie Scheffler', defaultOdds: '+450', worldRank: 1 },
  { id: 2, name: 'Rory McIlroy', defaultOdds: '+900', worldRank: 2 },
  { id: 3, name: 'Xander Schauffele', defaultOdds: '+1200', worldRank: 3 },
  { id: 4, name: 'Collin Morikawa', defaultOdds: '+1600', worldRank: 4 },
  { id: 5, name: 'Ludvig Aberg', defaultOdds: '+1800', worldRank: 5 },
  { id: 6, name: 'Tommy Fleetwood', defaultOdds: '+3500', worldRank: 12 },
  { id: 7, name: 'Patrick Cantlay', defaultOdds: '+3000', worldRank: 10 },
  { id: 8, name: 'Hideki Matsuyama', defaultOdds: '+4000', worldRank: 13 },
  { id: 9, name: 'Brooks Koepka', defaultOdds: '+4500', worldRank: 18 },
  { id: 10, name: 'Jordan Spieth', defaultOdds: '+5000', worldRank: 22 },
  { id: 11, name: 'Will Zalatoris', defaultOdds: '+5500', worldRank: 28 },
  { id: 12, name: 'Min Woo Lee', defaultOdds: '+7000', worldRank: 34 },
  { id: 13, name: 'Sahith Theegala', defaultOdds: '+8000', worldRank: 30 },
  { id: 14, name: 'Akshay Bhatia', defaultOdds: '+9000', worldRank: 37 },
] as const;

const DEFAULT_ROSTERS: Record<string, number[]> = {
  players: [1, 2, 8, 10, 12, 14],
  masters: [1, 2, 4, 8, 10, 12],
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
  canonicalName?: string;
};

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
};

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
};

type PoolInfo = {
  id: string;
  name: string;
  joinCode: string;
  lineupLocks: Partial<Record<TournamentId, boolean>>;
};

type PoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
};

type CommissionerMember = AuthUser;
type AuthMode = 'login' | 'register';

type StandingGolfer = ReturnType<typeof buildPricedPlayers>[number] & {
  position: string;
  thru: string;
  score: string;
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
  { id: 'static-2', name: 'Brady S.', rosters: { pga: [1, 3, 5, 7, 9, 11] } },
  { id: 'static-3', name: 'Megan T.', rosters: { pga: [2, 4, 6, 8, 12, 13] } },
  { id: 'static-4', name: 'Ryan H.', rosters: { pga: [3, 4, 5, 9, 10, 14] } },
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
  }>,
  liveOddsMap: Record<string, string>,
) {
  const playersWithOdds = playerPool.map((player) => ({
    ...player,
    odds: liveOddsMap[normalizeName(player.name)] ?? player.defaultOdds,
  }));
  const impliedProbabilities = playersWithOdds.map((player) => parseAmericanOdds(player.odds));
  const ranks = playersWithOdds.map((player) => player.worldRank);
  const minProbability = Math.min(...impliedProbabilities);
  const maxProbability = Math.max(...impliedProbabilities);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);

  return playersWithOdds.map((player) => {
    const oddsScore = normalizeValue(parseAmericanOdds(player.odds), minProbability, maxProbability);
    const rankScore = 1 - normalizeValue(player.worldRank, minRank, maxRank);
    const blendedScore = oddsScore * VEGAS_WEIGHT + rankScore * WORLD_RANK_WEIGHT;
    const salary =
      Math.round((SALARY_MIN + blendedScore * (SALARY_MAX - SALARY_MIN)) / 100) * 100;

    return {
      id: player.id,
      name: player.name,
      worldRank: player.worldRank,
      odds: player.odds,
      salary,
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
    year: 'numeric',
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

export default function Page() {
  const initialTournament = getDefaultTournamentId(getTournamentCardStatuses());
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  const [selectedTournament, setSelectedTournament] = useState<TournamentId>(initialTournament);
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTERS[initialTournament]);
  const [activeStandingEntryId, setActiveStandingEntryId] = useState<string | null>(null);
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
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [commissionerMembers, setCommissionerMembers] = useState<CommissionerMember[]>([]);
  const [commissionerBusy, setCommissionerBusy] = useState(false);
  const [commissionerError, setCommissionerError] = useState('');
  const [commissionerSuccess, setCommissionerSuccess] = useState('');
  const [selectedCommissionerMemberId, setSelectedCommissionerMemberId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountPreferencesView, setAccountPreferencesView] = useState<'root' | 'preferences' | 'password' | 'displayName'>('root');
  const [accountPassword, setAccountPassword] = useState('');
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

  const tournament = TOURNAMENTS.find((item) => item.id === selectedTournament) ?? TOURNAMENTS[0];
  const canManagePool = canAccessCommissionerConsole(sessionUser);

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
    if (mainTab === 'Commissioner console' && !canManagePool) {
      setMainTab('Standings');
    }
  }, [canManagePool, mainTab]);

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
    }, 180000);

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
      setPoolEntries((current) => [...current, { id: payload.member.id, name: payload.member.displayName, rosters: payload.member.rosters }]);
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

  const handleSelectCommissionerMember = (memberId: string) => {
    setSelectedCommissionerMemberId(memberId);
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
      setCommissionerSuccess('Member deleted.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to delete member.');
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
        const scoreBreakdown = buildPlaceholderScoreBreakdown({
          position,
          score,
          thru,
        });

        return {
          ...player,
          position,
          thru,
          score,
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
  const defaultLocked = isLineupLocked(tournament.lockAt, nowTick);
  const locked = pool?.lineupLocks?.[selectedTournament] ?? defaultLocked;
  const showFinalTournamentView = selectedTournamentStatus?.label === 'LOCKED';
  const showFutureTournamentView =
    selectedTournamentStatus?.label === 'UP NEXT' ||
    selectedTournamentStatus?.label === 'ACTIVE' ||
    selectedTournamentStatus === null;
  const displayTournamentWindow = getDisplayTournamentWindow(tournament, new Date(nowTick));
  const picksOpenForTournament = selectedTournamentStatus?.label === 'ACTIVE';
  const tournamentStartLabel = formatTournamentStartDate(displayTournamentWindow.inProgressAt);

  const userLabel = sessionUser?.displayName ?? 'Guest lineup';
  const liveStandingEntries =
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
          },
          ...STATIC_ENTRIES,
        ];

  const standings: StandingEntry[] = liveStandingEntries
    .map((entry) => {
      const picks = entry.rosters[selectedTournament] ?? [];
      const golfers = picks.map((id) => playersById[id]).filter(Boolean);
      const rosterPoints = golfers.reduce((sum, golfer) => sum + golfer.points, 0);
      const holesRemaining = golfers.reduce((sum, golfer) => sum + golfer.holesRemaining, 0);
      const tieBreakValue = picks.reduce((sum, id) => sum + id, 0) + 270;

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
        }),
      });

      applySession(payload);
      setSaveMessage('Lineup saved to your account for this tournament.');
      setMyEntriesEditorOpen(false);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save lineup.');
    }
  };

  const openMyEntriesEditor = () => {
    setSaveMessage('');
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSelectedRoster(savedRoster.length > 0 ? savedRoster : []);
    setMyEntriesEditorOpen(true);
    setMainTab('My entries');
  };

  const closeMyEntriesEditor = () => {
    setMyEntriesEditorOpen(false);
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSaveMessage('');
  };

  const renderRosterCards = (background: string) => (
    <div style={{ display: 'grid', gap: 10 }}>
      {orderedRosterPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #e6edf1',
            borderRadius: 16,
            padding: 14,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#2f5f96' }}>
              Roster {index + 1}
            </div>
            <div style={{ fontWeight: 700 }}>{player.name}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
              OWGR {player.worldRank} | ${player.salary.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{player.points}</div>
            <div style={{ fontSize: 12, color: '#2f5f96' }}>{player.holesRemaining} holes left</div>
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
      <div style={{ borderRadius: 16, background, padding: 14, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Salary used</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${salaryUsed.toLocaleString()}</div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 14, border }}>
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
      <div style={{ borderRadius: 16, background, padding: 14, border }}>
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 20px 40px' }}>
        <header
          style={{
            background: 'linear-gradient(135deg, #173b63 0%, #102842 100%)',
            color: '#fff',
            borderRadius: 28,
            padding: sessionUser ? '10px 28px 6px' : '10px 28px',
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
                width: 'min(100%, 380px)',
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
                justifyContent: 'center',
                gap: 12,
                flexWrap: 'wrap',
                paddingLeft: 72,
                paddingRight: 72,
              }}
            >
              {(['Standings', 'My entries', 'Details', 'Commissioner console'] as MainTab[])
                .filter((tab) => tab !== 'Commissioner console' || canManagePool)
                .map((tab) => {
                  const active = tab === mainTab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setMainTab(tab)}
                      style={{
                        border: 'none',
                        borderBottom: active ? '3px solid #63d9ea' : '3px solid transparent',
                        background: 'transparent',
                        color: active ? '#63d9ea' : '#ffffff',
                        padding: '7px 8px 9px',
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: 'pointer',
                        lineHeight: 1.1,
                      }}
                    >
                      {tab}
                    </button>
                  );
                })}
            </div>
          ) : null}

          {sessionUser ? (
            <div style={{ position: 'absolute', right: 22, bottom: 8, zIndex: 30 }}>
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
                    position: 'absolute',
                    right: 0,
                    bottom: 54,
                    width: 336,
                    borderRadius: 18,
                    background: '#fff',
                    color: '#0f1720',
                    padding: 16,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.22)',
                    zIndex: 20,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Account
                  </div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>{sessionUser.displayName}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>{sessionUser.email}</div>

                  {accountPreferencesView === 'password' ? (
                    <input
                      type="password"
                      value={accountPassword}
                      onChange={(event) => setAccountPassword(event.target.value)}
                      placeholder="New password"
                      style={{ ...fieldStyle(), marginTop: 14 }}
                    />
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
                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
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
              display: 'grid',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 'min(520px, 100%)',
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {authMode === 'login' ? <LogIn size={18} color="#2f5f96" /> : <UserPlus size={18} color="#2f5f96" />}
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
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
                <input
                  type="password"
                  value={authMode === 'login' ? loginForm.password : registerForm.password}
                  onChange={(event) =>
                    authMode === 'login'
                      ? setLoginForm({ ...loginForm, password: event.target.value })
                      : setRegisterForm({ ...registerForm, password: event.target.value })
                  }
                  placeholder="Password"
                  style={fieldStyle()}
                />
                <button
                  onClick={authMode === 'login' ? handleLogin : handleRegister}
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
                  {authMode === 'login' ? 'Sign in to the pool' : 'Create account'}
                </button>
              </div>

              <button
                onClick={() => {
                  setAuthMode((current) => (current === 'login' ? 'register' : 'login'));
                  setAuthError('');
                }}
                style={{
                  marginTop: 14,
                  border: 'none',
                  background: 'transparent',
                  color: '#2f5f96',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {authMode === 'login'
                  ? 'New Member? Click here to register'
                  : 'Already have an account? Click here to sign in'}
              </button>
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
                      borderRadius: '14px 14px 0 0',
                      padding: '10px 12px 9px',
                      width: TOURNAMENT_CARD_WIDTH,
                      height: TOURNAMENT_CARD_HEIGHT,
                      boxSizing: 'border-box',
                      flex: '0 0 auto',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
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
                          height: TOURNAMENT_TAB_LOGO_HEIGHTS[item.id] ?? 40,
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
              gridTemplateColumns: showFutureTournamentView
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
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <div>
                  {selectedTournament === 'players' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f1720' }}>
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
                        <span style={{ fontSize: 18, fontWeight: 500 }}>TPC Sawgrass</span>
                        <span style={{ fontSize: 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.players}</span>
                      </div>
                    </>
                  ) : selectedTournament === 'masters' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f1720' }}>
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
                        <span style={{ fontSize: 18, fontWeight: 500 }}>Augusta National Golf Club</span>
                        <span style={{ fontSize: 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.masters}</span>
                      </div>
                    </>
                  ) : selectedTournament === 'pga' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f1720' }}>
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
                        <span style={{ fontSize: 18, fontWeight: 500 }}>Aronimink Golf Club</span>
                        <span style={{ fontSize: 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.pga}</span>
                      </div>
                    </>
                  ) : selectedTournament === 'us-open' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f1720' }}>
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
                        <span style={{ fontSize: 18, fontWeight: 500 }}>Shinnecock Hills Golf Club</span>
                        <span style={{ fontSize: 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS['us-open']}</span>
                      </div>
                    </>
                  ) : selectedTournament === 'open' ? (
                    <>
                      <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f1720' }}>
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
                        <span style={{ fontSize: 18, fontWeight: 500 }}>Royal Birkdale Golf Club</span>
                        <span style={{ fontSize: 16, fontStyle: 'italic' }}>Par: {TOURNAMENT_PARS.open}</span>
                      </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5b6b79', fontSize: 14 }}>
                  <RefreshCw size={15} />
                  <span>
                    {showFutureTournamentView
                      ? picksOpenForTournament
                        ? 'Pool is open for lineup building'
                        : 'Tournament field not open for picks yet'
                      : showFinalTournamentView
                      ? 'Final tournament snapshot'
                      : isLoading
                        ? 'Refreshing live scores...'
                        : formatRefresh(feed?.fetchedAt ?? null)}
                  </span>
                </div>
              </div>

              {showFutureTournamentView ? (
                <div
                  style={{
                    marginTop: 28,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)',
                    gap: 28,
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 180,
                    }}
                  >
                    {TOURNAMENT_CARD_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_CARD_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 180,
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ color: '#0f1720', fontSize: 17, lineHeight: 1.55 }}>
                    <div style={{ fontSize: 20 }}>
                      {selectedTournament === 'pga' ? 'The PGA Championship' : tournament.name} begins on{' '}
                      {tournamentStartLabel}.
                    </div>
                    <div style={{ marginTop: 14 }}>
                      {picksOpenForTournament
                        ? 'The field has been finalized and picks are now open in the pool. Build your lineup before the first tee time on Thursday morning.'
                        : 'Picks can not be entered until the tournament field has been finalized and entered in our system (usually Monday morning the week of the tournament).'}
                    </div>

                    {picksOpenForTournament && selectedTournament === entriesTournamentId && sessionUser ? (
                      <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                        <div style={{ color: '#5b6b79', fontSize: 14 }}>
                          {otherSubmittedEntriesCount} other {otherSubmittedEntriesCount === 1 ? 'user has' : 'users have'} already
                          submitted picks for this tournament.
                        </div>
                        <div>
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
                            }}
                          >
                            <Pencil size={16} />
                            {hasSubmittedRoster ? 'Edit Picks' : 'Make Your Picks'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : showFinalTournamentView ? (
                <div style={{ marginTop: 28, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#5b6b79', fontSize: 12 }}>
                        <th style={{ padding: '0 18px 14px 0' }}>Rank</th>
                        <th style={{ padding: '0 18px 14px 0' }}>Entry</th>
                        <th style={{ padding: '0 18px 14px 0', textAlign: 'center' }}>Roster Points</th>
                        <th style={{ padding: '0 18px 14px 0', textAlign: 'center' }}>Holes Remaining</th>
                        <th style={{ padding: '0 0 14px', textAlign: 'center' }}>Tie-break</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          style={{
                            borderTop: '1px solid #e7edf2',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? '#eef4ff'
                                : 'transparent',
                          }}
                        >
                          <td style={{ padding: '16px 18px 16px 0', fontSize: 16 }}>{entry.place}</td>
                          <td style={{ padding: '16px 18px 16px 0' }}>
                            <button
                              onClick={() => setActiveStandingEntryId(entry.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                fontSize: 18,
                                color: '#0f1720',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              {entry.name}
                            </button>
                            {selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId) ? (
                              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#2f5f96', textTransform: 'uppercase' }}>
                                Picked selected golfer
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: '16px 18px 16px 0', textAlign: 'center', fontSize: 18 }}>
                            {entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: '16px 18px 16px 0', textAlign: 'center', fontSize: 18 }}>
                            {entry.holesRemaining}
                          </td>
                          <td style={{ padding: '16px 0', textAlign: 'center', fontSize: 18 }}>{entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 18, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#5b6b79', fontSize: 12, textTransform: 'uppercase' }}>
                          <th style={{ padding: '0 0 12px' }}>Place</th>
                          <th style={{ padding: '0 0 12px' }}>Entry</th>
                          <th style={{ padding: '0 0 12px' }}>Roster points</th>
                          <th style={{ padding: '0 0 12px' }}>Holes left</th>
                          <th style={{ padding: '0 0 12px' }}>Tie-break</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((entry) => (
                          <tr key={entry.id} style={{ borderTop: '1px solid #edf1f4' }}>
                            <td style={{ padding: '16px 0', fontWeight: 800, color: '#2f5f96' }}>#{entry.place}</td>
                            <td style={{ padding: '16px 0' }}>
                              <button
                                onClick={() => setActiveStandingEntryId(entry.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  fontWeight: 700,
                                  color: '#0f1720',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  fontSize: 18,
                                }}
                              >
                                {entry.name}
                              </button>
                              <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
                                {entry.golfers.map((golfer) => golfer.name.split(' ')[0]).join(', ') || 'No lineup saved'}
                              </div>
                            </td>
                            <td style={{ padding: '16px 0', fontWeight: 900, fontSize: 18 }}>{entry.rosterPoints}</td>
                            <td style={{ padding: '16px 0', fontWeight: 700 }}>{entry.holesRemaining}</td>
                            <td style={{ padding: '16px 0', fontWeight: 700, color: '#2f5f96' }}>{entry.tieBreakValue}</td>
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
                    borderRadius: 24,
                    padding: 22,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 30, color: '#0f1720' }}>{tournament.name} Leaderboard</h3>
                  </div>
                  <div style={{ marginTop: 24, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', fontSize: 12, color: '#5b6b79' }}>
                          <th style={{ padding: '10px 8px', border: '1px solid #d7dee6' }}>Pos.</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #d7dee6' }}>Player</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #d7dee6' }}>Total</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #d7dee6' }}>Thru</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #d7dee6' }}>Times Picked</th>
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
                              <td style={{ padding: '8px', border: '1px solid #e7edf2' }}>{player.position}</td>
                              <td style={{ padding: '8px', border: '1px solid #e7edf2', fontWeight: activePlayer ? 800 : 400 }}>{player.name}</td>
                              <td style={{ padding: '8px', border: '1px solid #e7edf2' }}>{player.score}</td>
                              <td style={{ padding: '8px', border: '1px solid #e7edf2' }}>{player.thru}</td>
                              <td style={{ padding: '8px', border: '1px solid #e7edf2', textAlign: 'center' }}>
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
          <main style={{ marginTop: 24, display: 'grid', gap: 20 }}>
            {!sessionUser ? (
              <div
                style={{
                  borderRadius: 18,
                  background: '#fff8e7',
                  color: '#9a6700',
                  border: '1px solid #f0d28a',
                  padding: '16px 18px',
                }}
              >
                This tab is ready for saved entries, but you need to sign in first so the lineup belongs to your account.
              </div>
            ) : sessionUser && !myEntriesEditorOpen ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 26, color: '#0f1720' }}>Manage Entries</h2>
                <div style={{ marginTop: 18, color: '#0f1720', fontSize: 15, lineHeight: 1.6 }}>
                  Make your picks for each entry below. You can modify your picks up until lineup lock unless the
                  commissioner has manually reopened editing for the tournament.
                </div>

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: 18,
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

                <div
                  style={{
                    marginTop: 24,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 1fr) minmax(260px, 1.2fr) 160px',
                    gap: 20,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720' }}>Entry</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720' }}>
                    {entriesTournamentId === 'pga' ? 'PGA Championship Picks' : `${entriesTournament.name} Picks`}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720', textAlign: 'right' }}>Options</div>

                  <div style={{ fontSize: 18, color: '#0f1720' }}>{userLabel}</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {hasSubmittedRoster ? (
                      <div
                        style={{
                          borderRadius: 16,
                          border: '1px solid #dce6ee',
                          background: '#f8fbfd',
                          padding: '12px 14px',
                          display: 'grid',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {savedRosterPlayers.map((player) => (
                            <span
                              key={player.id}
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
                        <div style={{ color: '#5b6b79', fontSize: 13 }}>
                          Roster submitted for {entriesTournament.name}. You can reopen it with <strong>Edit Picks</strong>{' '}
                          while lineups are unlocked.
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={openMyEntriesEditor}
                        style={{
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: '#7ee5e6',
                          color: '#0f1720',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Pencil size={14} />
                        Make Your Picks
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', position: 'relative' }}>
                    <button
                      onClick={() => setMyEntriesMenuOpen((current) => !current)}
                      style={{
                        border: '1px solid #d7e0e8',
                        borderRadius: 14,
                        width: 48,
                        height: 48,
                        background: '#fff',
                        color: '#0f1720',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {myEntriesMenuOpen ? (
                      <div
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
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 30, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  <button
                    onClick={closeMyEntriesEditor}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 14,
                      padding: '12px 18px',
                      background: '#fff',
                      color: '#0f1720',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Back to entries
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.55fr) minmax(320px, 0.85fr)',
                    gap: 28,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 20 }}>
                    <div
                      style={{
                        borderRadius: 16,
                        background: '#d8f6f7',
                        color: '#0f1720',
                        padding: '18px 22px',
                        fontSize: 15,
                        lineHeight: 1.5,
                      }}
                    >
                      NOTE: Salaries are now determined by using a golfer&apos;s odds to win the tournament instead of
                      using their Official World Golf Ranking. This was done to properly assign salaries to LIV golfers
                      who will participate in majors.
                    </div>

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
                          padding: 22,
                          background: '#f3f6fa',
                          borderBottom: '1px solid #dce6ee',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 16,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ fontSize: 26, lineHeight: 1.25, fontWeight: 900, color: '#0f1720' }}>
                          {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name}
                          <br />
                          Tournament Field
                        </div>
                        <div
                          style={{
                            width: 340,
                            maxWidth: '100%',
                            borderRadius: 12,
                            border: '1px solid #d7e0e8',
                            background: '#fff',
                            padding: '14px 18px',
                            color: '#97a3ad',
                            fontSize: 15,
                          }}
                        >
                          Player search
                        </div>
                      </div>

                      <div style={{ padding: 20, minHeight: 430 }}>
                        <div
                          style={{
                            borderRadius: 14,
                            background: '#f7f0da',
                            color: '#7a5a00',
                            padding: '18px 20px',
                            fontSize: 15,
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
                        padding: '16px 20px',
                        background: '#fff',
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 4, fontSize: 44, lineHeight: 1, fontWeight: 900, color: '#198754' }}>
                        ${SALARY_CAP.toLocaleString()}
                      </div>
                      <div style={{ marginTop: 12, color: '#0f1720', fontSize: 15 }}>
                        Avg Rem./Player: ${(SALARY_CAP / REQUIRED_GOLFERS).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ fontSize: 30, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>
                    <div
                      style={{
                        borderRadius: 16,
                        background: '#d8f6f7',
                        padding: '16px 20px',
                        color: '#0f1720',
                        fontSize: 15,
                      }}
                    >
                      No players selected
                    </div>
                    <div style={{ color: '#0f1720', fontSize: 14 }}>
                      Click the plus sign to add a golfer or the minus sign to remove them.
                    </div>

                    <div style={{ display: 'grid', gap: 14 }}>
                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => (
                        <div
                          key={`placeholder-slot-${index + 1}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '70px minmax(0, 1fr)',
                            alignItems: 'center',
                            borderRadius: 14,
                            border: '1px solid #d7e0e8',
                            background: '#fff',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              minHeight: 92,
                              background: 'linear-gradient(180deg, #e7eaee 0%, #d8dde3 100%)',
                            }}
                          />
                          <div style={{ padding: '0 18px', fontSize: 18, color: '#556572' }}>Golfer #{index + 1}</div>
                        </div>
                      ))}
                    </div>

                    <input
                      disabled
                      placeholder="Enter tiebreak value*"
                      style={{
                        ...fieldStyle(),
                        opacity: 0.78,
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
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                      Pick Sheet
                    </div>
                    <h2 style={{ margin: '6px 0 0', fontSize: 30, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                  <button
                    onClick={closeMyEntriesEditor}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 14,
                      padding: '12px 18px',
                      background: '#fff',
                      color: '#0f1720',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Back to entries
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 20,
                  }}
                >
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div
                      style={{
                        borderRadius: 16,
                        background: '#d8f6f7',
                        color: '#0f1720',
                        padding: '18px 22px',
                        fontSize: 15,
                        lineHeight: 1.5,
                      }}
                    >
                      NOTE: Salaries are now determined by using a golfer&apos;s odds to win the tournament instead of
                      using their Official World Golf Ranking. This was done to properly assign salaries to LIV golfers
                      who will participate in majors.
                    </div>

                    <section
                      style={{
                        background: '#fff',
                        borderRadius: 20,
                        padding: 18,
                        border: '1px solid #e6edf1',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Trophy size={18} color="#2f5f96" />
                        <div style={{ fontSize: 18, fontWeight: 900 }}>
                          {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name} Tournament Field
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        {players.map((player) => {
                          const selected = selectedRoster.includes(player.id);
                          const disabled =
                            !selected &&
                            (entriesLocked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                          return (
                            <button
                              key={player.id}
                              onClick={() => togglePlayer(player.id)}
                              style={{
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
                                opacity: disabled ? 0.58 : 1,
                              }}
                              disabled={disabled}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>
                                    {player.name}
                                  </div>
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
                  </div>

                  <div
                    style={{
                      background: '#f8fbfd',
                      border: '1px solid #e6edf1',
                      borderRadius: 20,
                      padding: 18,
                    }}
                  >
                    {renderRosterCards('#fff')}
                    {renderBudgetCards('#fff', '1px solid #e6edf1')}

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
                  </div>
                </div>
              </section>
            ) : null}
          </main>
        )}

        {mainTab === 'Details' && (
          <main style={{ marginTop: 24, display: 'grid', gap: 20 }}>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f1720' }}>
                <span style={{ marginRight: 8 }}>🏌️</span>
                Roster &amp; Entry Details
              </div>
              <div style={{ marginTop: 14, display: 'grid', gap: 18, color: '#0f1720', lineHeight: 1.6, fontSize: 15 }}>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  For each major tournament, and The Players Championship, members select <strong>six golfers</strong>.
                  Each golfer will have a salary assigned to them based on a blend of their world ranking and odds to
                  win the tournament.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  Participants will be assigned a fixed salary cap of <strong>$50,000</strong> they must stay under in
                  order to create their 6-player roster. These six golfers make up their Player Roster for that
                  tournament.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  Golfers <strong>CAN be picked more than once per season.</strong> Points are awarded based on the
                  players hole by hole performance, as well as their tournament standings. Cut players receive
                  <strong> -10 points.</strong>
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  <strong>1st, 2nd and 3rd places pay out</strong>, and amounts vary based on the size of the pool
                  field.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  The scores of all <strong>6 golfers</strong> on your roster count towards your score.
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  You’ll enter what you think the winning score for the champion will be (i.e. -12) when entering your
                  picks, to serve as a tiebreaker value.
                </div>
              </div>
              <div style={{ margin: '20px 0', borderTop: '1px solid #d7dee6' }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f1720' }}>
                <span style={{ marginRight: 8 }}>💰</span>
                Entry &amp; Contact
              </div>
              <div style={{ marginTop: 14, display: 'grid', gap: 10, color: '#0f1720', lineHeight: 1.6, fontSize: 15 }}>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  Entry Fee: $25
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  Venmo: @claytont743
                </div>
                <div>
                  <span style={{ color: '#43b36b', marginRight: 6 }}>🟢</span>
                  <span style={{ marginRight: 6 }}>➤</span>
                  Questions: Clayton Tucker <span style={{ margin: '0 4px' }}>📞</span> (325.665.8299)
                </div>
              </div>
              <div style={{ margin: '24px 0 18px', borderTop: '1px solid #d7dee6' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#0f1720' }}>
                <span style={{ fontSize: 18 }}>{'📊'}</span>
                <span>Points are awarded as follows:</span>
              </div>
              <div
                style={{
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 36,
                  color: '#0f1720',
                  fontSize: 15,
                  lineHeight: 1.35,
                }}
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Triple+:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-5 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Double:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-3 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Bogey:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-1 pts</span></div>
                  <div style={{ margin: '6px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Par:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>.5 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Birdie:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>3 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Eagle:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>8 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Albatross:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>13 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Ace:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>10 pts</span></div>
                  <div style={{ margin: '6px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>3 Birdie Streak:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>4 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Bogey Free Rnd:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Tourney Low Rnd:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>6 pts</span></div>
                  <div style={{ margin: '6px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>1<sup>st</sup> Rnd Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>2<sup>nd</sup> Rnd Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>3<sup>rd</sup> Rnd Leader:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ marginRight: 10 }}>{'🥇'}</span><strong>1st Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>40 pts</span></div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ marginRight: 10 }}>{'🥈'}</span><strong>2nd Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>25 pts</span></div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}><span style={{ marginRight: 10 }}>{'🥉'}</span><strong>3rd Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>20 pts</span></div>
                  </div>
                  <div style={{ margin: '6px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>4th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>18 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>5th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>16 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>6th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>14 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>7th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>12 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>8th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>10 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>9th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>9 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>10th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>8 pts</span></div>
                  <div style={{ margin: '6px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>11-15th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>7 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>16-20th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>6 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>21-25th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>5 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>26-30th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>3 pts</span></div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>31-40th Place:</strong> <span style={{ color: '#16a34a', fontWeight: 500 }}>1 pts</span></div>
                  <div style={{ margin: '6px 0 2px', borderTop: '2px solid #c5c7cc', width: '78%' }} />
                  <div style={{ fontSize: 18, fontWeight: 800 }}><strong>Cut Players:</strong> <span style={{ color: '#dc2626', fontWeight: 500 }}>-10 pts</span></div>
                </div>
              </div>
            </section>
          </main>
        )}

        {mainTab === 'Commissioner console' && (
          <main style={{ marginTop: 24, display: 'grid', gap: 20 }}>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Commissioner console
              </div>
              <h2 style={{ margin: '6px 0 18px', fontSize: 26, color: '#0f1720' }}>
                Live feed and pool status for {tournament.name}
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Source
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>Slash Golf API</div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Last sync
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{formatRefresh(feed?.fetchedAt ?? null)}</div>
                </div>
                <button
                  onClick={handleToggleLineupLock}
                  disabled={!canManagePool || commissionerBusy}
                  style={{
                    border: '1px solid #e6edf1',
                    borderRadius: 18,
                    padding: 16,
                    background: '#f8fbfd',
                    textAlign: 'left',
                    cursor: !canManagePool || commissionerBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Lineup lock
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{locked ? 'Locked' : 'Unlocked'}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#5b6b79' }}>
                    {locked ? 'Click to unlock roster editing' : 'Click to lock roster editing'}
                  </div>
                </button>
                <div style={{ border: '1px solid #e6edf1', borderRadius: 18, padding: 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Pool members
                  </div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>{poolEntries.length}</div>
                </div>
              </div>
            </section>

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Submission status
              </div>
              <h2 style={{ margin: '6px 0 18px', fontSize: 26, color: '#0f1720' }}>
                {entriesTournamentId === 'pga' ? 'PGA Championship' : entriesTournament.name} pick submissions
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 20,
                }}
              >
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
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>Submitted Picks</div>
                  {submittedCommissionerMembers.length > 0 ? (
                    submittedCommissionerMembers.map((member) => (
                      <div
                        key={`submitted-${member.id}`}
                        style={{ borderRadius: 14, background: '#fff', padding: '12px 14px', color: '#0f1720', fontWeight: 700 }}
                      >
                        {member.displayName}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88' }}>No registered members have submitted picks yet.</div>
                  )}
                </div>

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
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>Still Need Picks</div>
                  {pendingCommissionerMembers.length > 0 ? (
                    pendingCommissionerMembers.map((member) => (
                      <div
                        key={`pending-${member.id}`}
                        style={{ borderRadius: 14, background: '#fff', padding: '12px 14px', color: '#0f1720', fontWeight: 700 }}
                      >
                        {member.displayName}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88' }}>Everyone with a registered account has submitted picks.</div>
                  )}
                </div>
              </div>
            </section>

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                Member management
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: '6px 0 18px', fontSize: 26, color: '#0f1720' }}>
                  Edit pool members and saved lineups
                </h2>
                <button
                  onClick={() => setShowAddMemberForm((current) => !current)}
                  style={{
                    border: 'none',
                    borderRadius: 14,
                    padding: '12px 16px',
                    background: '#2d5e94',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {showAddMemberForm ? 'Close Add Members' : 'Add Members'}
                </button>
              </div>

              {!canManagePool ? (
                <div
                  style={{
                    borderRadius: 18,
                    background: '#fff8e7',
                    color: '#9a6700',
                    border: '1px solid #f0d28a',
                    padding: '16px 18px',
                  }}
                >
                  Sign in to load and manage pool members.
                </div>
              ) : (
                <>
                  {showAddMemberForm ? (
                    <div
                      style={{
                        marginBottom: 18,
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
                        <input
                          type="password"
                          value={memberCreateForm.password}
                          onChange={(event) => setMemberCreateForm({ ...memberCreateForm, password: event.target.value })}
                          placeholder="Password"
                          style={fieldStyle()}
                        />
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
                        marginBottom: 14,
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
                        marginBottom: 14,
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

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(260px, 0.8fr) minmax(0, 1.4fr)',
                      gap: 20,
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #e6edf1',
                        borderRadius: 20,
                        padding: 14,
                        background: '#f8fbfd',
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      {commissionerBusy && commissionerMembers.length === 0 ? (
                        <div style={{ color: '#6b7b88' }}>Loading members...</div>
                      ) : commissionerMembers.length === 0 ? (
                        <div style={{ color: '#6b7b88' }}>No pool members found yet.</div>
                      ) : (
                        commissionerMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => handleSelectCommissionerMember(member.id)}
                            style={{
                              border: member.id === selectedCommissionerMemberId ? '2px solid #3f73ad' : '1px solid #d7e0e8',
                              borderRadius: 16,
                              background: member.id === selectedCommissionerMemberId ? '#eef4ff' : '#fff',
                              padding: 14,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontWeight: 800, color: '#0f1720' }}>{member.displayName}</div>
                            <div style={{ marginTop: 4, color: '#6b7b88', fontSize: 13 }}>{member.email}</div>
                            <div style={{ marginTop: 6, color: '#2f5f96', fontSize: 12, fontWeight: 800 }}>
                              {TOURNAMENTS.filter((event) => (member.rosters[event.id] ?? []).length > 0).length} saved lineup(s)
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    <div
                      style={{
                        border: '1px solid #e6edf1',
                        borderRadius: 20,
                        padding: 18,
                        background: '#fff',
                      }}
                    >
                      {selectedCommissionerMember ? (
                        <div style={{ display: 'grid', gap: 14 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                              Editing member
                            </div>
                            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: '#0f1720' }}>
                              {selectedCommissionerMember.displayName}
                            </div>
                          </div>

                          <input
                            value={memberEditForm.displayName}
                            onChange={(event) => setMemberEditForm({ ...memberEditForm, displayName: event.target.value })}
                            placeholder="Display name"
                            style={fieldStyle()}
                          />
                          <input
                            value={memberEditForm.email}
                            onChange={(event) => setMemberEditForm({ ...memberEditForm, email: event.target.value })}
                            placeholder="Email"
                            style={fieldStyle()}
                          />
                          <input
                            type="password"
                            value={memberEditForm.password}
                            onChange={(event) => setMemberEditForm({ ...memberEditForm, password: event.target.value })}
                            placeholder="New password (leave blank to keep current)"
                            style={fieldStyle()}
                          />

                          <div style={{ fontSize: 12, color: '#6b7b88' }}>
                            Edit picks as comma-separated golfer IDs.
                            {' '}Available golfers:
                            {' '}
                            {PLAYER_POOL.map((player) => `${player.id} ${player.name}`).join(' • ')}
                          </div>

                          {TOURNAMENTS.map((event) => (
                            <div key={event.id} style={{ display: 'grid', gap: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#31424f' }}>{event.name} picks</div>
                              <input
                                value={memberEditForm.rosters[event.id]}
                                onChange={(eventInput) =>
                                  setMemberEditForm({
                                    ...memberEditForm,
                                    rosters: { ...memberEditForm.rosters, [event.id]: eventInput.target.value },
                                  })
                                }
                                placeholder="Example: 1, 2, 5, 8, 10, 14"
                                style={fieldStyle()}
                              />
                            </div>
                          ))}

                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button
                              onClick={handleSaveCommissionerMember}
                              disabled={commissionerBusy}
                              style={{
                                border: 'none',
                                borderRadius: 16,
                                padding: '14px 18px',
                                background: 'linear-gradient(135deg, #3f73ad 0%, #315f95 100%)',
                                color: '#fff',
                                fontWeight: 900,
                                cursor: commissionerBusy ? 'wait' : 'pointer',
                              }}
                            >
                              Save member changes
                            </button>
                            <button
                              onClick={handleDeleteCommissionerMember}
                              disabled={commissionerBusy}
                              style={{
                                border: '1px solid #fecaca',
                                borderRadius: 16,
                                padding: '14px 18px',
                                background: '#fff5f5',
                                color: '#a61b1b',
                                fontWeight: 900,
                                cursor: commissionerBusy ? 'wait' : 'pointer',
                              }}
                            >
                              Delete account
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: '#6b7b88' }}>
                          Select a member on the left to edit their display name, email, password, and saved picks.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          </main>
        )}

        </>
        ) : null}

        {activeStandingEntry ? (
          <div
            onClick={() => setActiveStandingEntryId(null)}
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
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(760px, 100%)',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Entry breakdown
                  </div>
                  <h3 style={{ margin: '6px 0 0', fontSize: 28, color: '#0f1720' }}>{activeStandingEntry.name}</h3>
                  <div style={{ marginTop: 6, color: '#6b7b88' }}>
                    Place #{activeStandingEntry.place} in {tournament.name}
                  </div>
                </div>
                <button
                  onClick={() => setActiveStandingEntryId(null)}
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

              <div
                style={{
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ borderRadius: 18, background: '#f6fbfd', padding: 16, border: '1px solid #e6edf1' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Roster size
                  </div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{activeStandingEntry.golfers.length}</div>
                </div>
                <div style={{ borderRadius: 18, background: '#f6fbfd', padding: 16, border: '1px solid #e6edf1' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Roster points
                  </div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{activeStandingEntry.rosterPoints}</div>
                </div>
                <div style={{ borderRadius: 18, background: '#eef4ff', padding: 16, border: '1px solid #c7d8ee' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#2f5f96' }}>
                    Holes remaining
                  </div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: '#2f5f96' }}>{activeStandingEntry.holesRemaining}</div>
                </div>
                <div style={{ borderRadius: 18, background: '#f9fafb', padding: 16, border: '1px solid #e6edf1' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Tie-break
                  </div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{activeStandingEntry.tieBreakValue}</div>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
                {activeStandingEntry.golfers.length > 0 ? (
                  activeStandingEntry.golfers.map((golfer, index) => (
                    <div
                      key={golfer.id}
                      style={{
                        border: '1px solid #e6edf1',
                        borderRadius: 18,
                        padding: 16,
                        background: '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#2f5f96' }}>
                            Roster {index + 1}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: '#0f1720' }}>{golfer.name}</div>
                          <div style={{ marginTop: 4, color: '#6b7b88', fontSize: 13 }}>
                            OWGR {golfer.worldRank} | {golfer.odds} | Pos {golfer.position} | Thru {golfer.thru}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                            Tournament points
                          </div>
                          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900 }}>{golfer.points}</div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 10,
                        }}
                      >
                        <div style={{ borderRadius: 14, background: '#f6fbfd', padding: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                            Placement points
                          </div>
                          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{golfer.scoreBreakdown.placementPoints}</div>
                          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
                            Position {golfer.position} earns full tied-place points
                          </div>
                        </div>
                        <div style={{ borderRadius: 14, background: '#eef4ff', padding: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#2f5f96' }}>
                            Hole and streak points
                          </div>
                          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: '#2f5f96' }}>
                            {golfer.scoreBreakdown.holePoints + golfer.scoreBreakdown.streakPoints}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
                            Awaiting live scorecard integration
                          </div>
                        </div>
                        <div style={{ borderRadius: 14, background: '#f9fafb', padding: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                            Holes remaining
                          </div>
                          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{golfer.holesRemaining}</div>
                          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>
                            Cut players automatically go to zero
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
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
                  marginTop: 18,
                  borderRadius: 16,
                  background: '#f5f9fb',
                  padding: 14,
                  color: '#50616f',
                  lineHeight: 1.5,
                }}
              >
                This scoring panel is now built around your custom points system. Hole-by-hole and round-based categories
                are scaffolded in the UI and will populate from Slash Golf scorecards once the API key is added.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
