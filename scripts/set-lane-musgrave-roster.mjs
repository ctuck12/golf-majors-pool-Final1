import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
// Ludvig Aberg=5, Keegan Bradley=36, Bryson DeChambeau=15, Min Woo Lee=12, Marco Penge=112, Cameron Young=23
const MASTERS_ROSTER = [5, 36, 15, 12, 112, 23];
const TIEBREAK = 270;
const TARGET_DISPLAY_NAME = 'Lane Musgrave';
const TOURNAMENT_ID = 'masters';

const raw = await redis.get(DB_KEY);
if (!raw) { console.error('No database found in Redis.'); process.exit(1); }

const db = JSON.parse(raw);
const user = db.users.find(u => u.displayName === TARGET_DISPLAY_NAME);
if (!user) { console.error(`User "${TARGET_DISPLAY_NAME}" not found.`); process.exit(1); }

user.rosters = user.rosters ?? {};
user.tieBreaks = user.tieBreaks ?? {};
user.rosters[TOURNAMENT_ID] = MASTERS_ROSTER;
user.tieBreaks[TOURNAMENT_ID] = TIEBREAK;

await redis.set(DB_KEY, JSON.stringify(db));
console.log(`Updated ${TARGET_DISPLAY_NAME}: Masters roster = [${MASTERS_ROSTER}], tiebreak = ${TIEBREAK}`);
await redis.quit();
