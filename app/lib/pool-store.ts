import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const SESSION_COOKIE_NAME = 'golf-pool-session';
export const DEFAULT_POOL_ID = 'golf-majors-pool';
export const DEFAULT_POOL_JOIN_CODE = 'MAJORS2026';
export const TOURNAMENT_IDS = ['players', 'masters', 'pga', 'us-open', 'open'] as const;

export type TournamentId = (typeof TOURNAMENT_IDS)[number];
export type TournamentPayouts = {
  first: number;
  second: number;
  third: number;
};

type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  createdAt: string;
};

type StoredSession = {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

type StoredPool = {
  id: string;
  name: string;
  joinCode: string;
  memberUserIds: string[];
  lineupLocks: Partial<Record<TournamentId, boolean>>;
  payouts: Partial<Record<TournamentId, TournamentPayouts>>;
  createdAt: string;
};

type StoredDatabase = {
  users: StoredUser[];
  sessions: StoredSession[];
  pools: StoredPool[];
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
};

export type PublicPoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
};

export type PublicPool = {
  id: string;
  name: string;
  joinCode: string;
  lineupLocks: Partial<Record<TournamentId, boolean>>;
  payouts: Partial<Record<TournamentId, TournamentPayouts>>;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_ROOT =
  process.env.POOL_DATA_DIR ??
  (process.env.VERCEL ? path.join(os.tmpdir(), 'golf-majors-pool-data') : DATA_DIR);
const DATA_FILE = path.join(DATA_ROOT, 'pool-data.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeJoinCode(joinCode: string) {
  return joinCode.trim().toUpperCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

function sanitizeRoster(roster: unknown) {
  if (!Array.isArray(roster)) {
    return [];
  }

  const seen = new Set<number>();
  const sanitized: number[] = [];

  for (const value of roster) {
    const numeric = Number(value);

    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 14 || seen.has(numeric)) {
      continue;
    }

    seen.add(numeric);
    sanitized.push(numeric);

    if (sanitized.length === 6) {
      break;
    }
  }

  return sanitized;
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    poolIds: user.poolIds,
    rosters: user.rosters,
    tieBreaks: user.tieBreaks ?? {},
  };
}

async function ensureDataFile() {
  await mkdir(DATA_ROOT, { recursive: true });

  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    const createdAt = nowIso();
    const initialData: StoredDatabase = {
      users: [],
      sessions: [],
      pools: [
        {
          id: DEFAULT_POOL_ID,
          name: 'Golf Majors Pool',
          joinCode: DEFAULT_POOL_JOIN_CODE,
          memberUserIds: [],
          lineupLocks: {},
          payouts: {},
          createdAt,
        },
      ],
    };

    await writeFile(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

async function readDatabase() {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as StoredDatabase;

  parsed.pools = parsed.pools.length
    ? parsed.pools
    : [
        {
          id: DEFAULT_POOL_ID,
          name: 'Golf Majors Pool',
          joinCode: DEFAULT_POOL_JOIN_CODE,
          memberUserIds: [],
          lineupLocks: {},
          payouts: {},
          createdAt: nowIso(),
        },
      ];

  parsed.pools = parsed.pools.map((pool) => ({
    ...pool,
    lineupLocks: pool.lineupLocks ?? {},
    payouts: pool.payouts ?? {},
  }));

  parsed.users = parsed.users.map((user) => ({
    ...user,
    tieBreaks: user.tieBreaks ?? {},
  }));

  parsed.sessions = parsed.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
  return parsed;
}

async function writeDatabase(database: StoredDatabase) {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(database, null, 2), 'utf8');
}

export async function registerUser(input: {
  displayName: string;
  email: string;
  password: string;
  joinCode?: string;
}) {
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;
  const joinCode = input.joinCode ? normalizeJoinCode(input.joinCode) : '';

  if (displayName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }

  if (!email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const database = await readDatabase();

  if (database.users.some((user) => user.email === email)) {
    throw new Error('An account with that email already exists.');
  }

  const passwordSalt = randomBytes(16).toString('hex');
  const user: StoredUser = {
    id: randomBytes(12).toString('hex'),
    email,
    displayName,
    passwordHash: hashPassword(password, passwordSalt),
    passwordSalt,
    poolIds: [],
    rosters: {},
    tieBreaks: {},
    createdAt: nowIso(),
  };

  const poolToJoin = joinCode
    ? database.pools.find((item) => item.joinCode === joinCode)
    : database.pools.find((item) => item.id === DEFAULT_POOL_ID);

  if (!poolToJoin) {
    throw new Error(joinCode ? 'That pool join code was not recognized.' : 'Default pool was not found.');
  }

  if (!poolToJoin.memberUserIds.includes(user.id)) {
    poolToJoin.memberUserIds.push(user.id);
  }

  if (!user.poolIds.includes(poolToJoin.id)) {
    user.poolIds.push(poolToJoin.id);
  }

  database.users.push(user);
  await writeDatabase(database);
  return toPublicUser(user);
}

export async function loginUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const database = await readDatabase();
  const user = database.users.find((item) => item.email === email);

  if (!user) {
    throw new Error('Email or password is incorrect.');
  }

  const expectedHash = Buffer.from(user.passwordHash, 'hex');
  const receivedHash = Buffer.from(hashPassword(password, user.passwordSalt), 'hex');

  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
    throw new Error('Email or password is incorrect.');
  }

  return toPublicUser(user);
}

export async function createSession(userId: string) {
  const database = await readDatabase();
  const token = randomBytes(32).toString('hex');

  database.sessions.push({
    token,
    userId,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  await writeDatabase(database);
  return token;
}

export async function removeSession(token: string) {
  const database = await readDatabase();
  database.sessions = database.sessions.filter((session) => session.token !== token);
  await writeDatabase(database);
}

export async function getSessionContext(token: string | undefined) {
  if (!token) {
    return { user: null, pool: null, entries: [] as PublicPoolEntry[] };
  }

  const database = await readDatabase();
  const session = database.sessions.find((item) => item.token === token);

  if (!session) {
    return { user: null, pool: null, entries: [] as PublicPoolEntry[] };
  }

  const user = database.users.find((item) => item.id === session.userId);

  if (!user) {
    return { user: null, pool: null, entries: [] as PublicPoolEntry[] };
  }

  const activePool = database.pools.find((pool) => user.poolIds.includes(pool.id)) ?? null;
  const entries = activePool
    ? database.users
        .filter((item) => activePool.memberUserIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          name: item.displayName,
          rosters: item.rosters,
          tieBreaks: item.tieBreaks ?? {},
        }))
    : [];

  return {
    user: toPublicUser(user),
    pool: activePool
      ? {
          id: activePool.id,
          name: activePool.name,
          joinCode: activePool.joinCode,
          lineupLocks: activePool.lineupLocks,
          payouts: activePool.payouts,
        }
      : null,
    entries,
  };
}

export async function joinPoolForUser(userId: string, joinCode: string) {
  const normalizedCode = normalizeJoinCode(joinCode);

  if (!normalizedCode) {
    throw new Error('Enter a pool join code.');
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  const pool = database.pools.find((item) => item.joinCode === normalizedCode);

  if (!pool) {
    throw new Error('That pool join code was not recognized.');
  }

  if (!user.poolIds.includes(pool.id)) {
    user.poolIds.push(pool.id);
  }

  if (!pool.memberUserIds.includes(user.id)) {
    pool.memberUserIds.push(user.id);
  }

  await writeDatabase(database);

  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    lineupLocks: pool.lineupLocks,
    payouts: pool.payouts,
  } satisfies PublicPool;
}

export async function saveRosterForUser(userId: string, tournamentId: TournamentId, roster: unknown) {
  if (!TOURNAMENT_IDS.includes(tournamentId)) {
    throw new Error('Unknown tournament.');
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  user.rosters[tournamentId] = sanitizeRoster(roster);
  await writeDatabase(database);

  return user.rosters[tournamentId] ?? [];
}

export async function saveTieBreakForUser(userId: string, tournamentId: TournamentId, tieBreak: number) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  if (!user.tieBreaks) {
    user.tieBreaks = {};
  }

  user.tieBreaks[tournamentId] = tieBreak;
  await writeDatabase(database);
}

export async function updateUserAccount(
  userId: string,
  updates: {
    password?: string;
    displayName?: string;
  },
) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  if (typeof updates.displayName === 'string') {
    const displayName = updates.displayName.trim();

    if (displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters.');
    }

    user.displayName = displayName;
  }

  if (typeof updates.password === 'string' && updates.password.length > 0) {
    if (updates.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const passwordSalt = randomBytes(16).toString('hex');
    user.passwordSalt = passwordSalt;
    user.passwordHash = hashPassword(updates.password, passwordSalt);
  }

  await writeDatabase(database);
  return toPublicUser(user);
}

export async function listPoolMembers(userId: string) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  const activePool = database.pools.find((pool) => user.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    return [];
  }

  return database.users
    .filter((item) => activePool.memberUserIds.includes(item.id))
    .map((item) => toPublicUser(item));
}

export async function updatePoolMember(
  requestingUserId: string,
  memberId: string,
  updates: {
    displayName?: string;
    email?: string;
    password?: string;
    rosters?: Partial<Record<TournamentId, unknown>>;
  },
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool = database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool || !activePool.memberUserIds.includes(memberId)) {
    throw new Error('Pool member was not found.');
  }

  const member = database.users.find((item) => item.id === memberId);

  if (!member) {
    throw new Error('Pool member was not found.');
  }

  if (typeof updates.displayName === 'string') {
    const displayName = updates.displayName.trim();
    if (displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters.');
    }
    member.displayName = displayName;
  }

  if (typeof updates.email === 'string') {
    const email = normalizeEmail(updates.email);
    if (!email.includes('@')) {
      throw new Error('Enter a valid email address.');
    }
    const existing = database.users.find((item) => item.email === email && item.id !== member.id);
    if (existing) {
      throw new Error('An account with that email already exists.');
    }
    member.email = email;
  }

  if (typeof updates.password === 'string' && updates.password.trim().length > 0) {
    if (updates.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    const passwordSalt = randomBytes(16).toString('hex');
    member.passwordSalt = passwordSalt;
    member.passwordHash = hashPassword(updates.password, passwordSalt);
  }

  if (updates.rosters) {
    for (const tournamentId of TOURNAMENT_IDS) {
      if (Object.prototype.hasOwnProperty.call(updates.rosters, tournamentId)) {
        member.rosters[tournamentId] = sanitizeRoster(updates.rosters[tournamentId]);
      }
    }
  }

  await writeDatabase(database);
  return toPublicUser(member);
}

export async function deletePoolMember(requestingUserId: string, memberId: string) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool = database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool || !activePool.memberUserIds.includes(memberId)) {
    throw new Error('Pool member was not found.');
  }

  database.users = database.users.filter((item) => item.id !== memberId);
  database.sessions = database.sessions.filter((item) => item.userId !== memberId);

  for (const pool of database.pools) {
    pool.memberUserIds = pool.memberUserIds.filter((id) => id !== memberId);
  }

  await writeDatabase(database);
}

export async function updatePoolLineupLock(
  requestingUserId: string,
  tournamentId: TournamentId,
  locked: boolean,
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool =
    database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  activePool.lineupLocks = activePool.lineupLocks ?? {};
  activePool.lineupLocks[tournamentId] = locked;
  await writeDatabase(database);

  return {
    id: activePool.id,
    name: activePool.name,
    joinCode: activePool.joinCode,
    lineupLocks: activePool.lineupLocks,
    payouts: activePool.payouts,
  } satisfies PublicPool;
}

export async function updatePoolPayouts(
  requestingUserId: string,
  tournamentId: TournamentId,
  payouts: TournamentPayouts,
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool =
    database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  activePool.payouts = activePool.payouts ?? {};
  activePool.payouts[tournamentId] = {
    first: payouts.first,
    second: payouts.second,
    third: payouts.third,
  };
  await writeDatabase(database);

  return {
    id: activePool.id,
    name: activePool.name,
    joinCode: activePool.joinCode,
    lineupLocks: activePool.lineupLocks,
    payouts: activePool.payouts,
  } satisfies PublicPool;
}
