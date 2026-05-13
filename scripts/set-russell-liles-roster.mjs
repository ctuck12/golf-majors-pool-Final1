import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
// Ludvig Aberg=5, Jacob Bridgeman=60, Bryson DeChambeau=15, Tommy Fleetwood=6, Collin Morikawa=4, Bubba Watson=195
const MASTERS_ROSTER = [5, 60, 15, 6, 4, 195];
const TIEBREAK = 272;
const TARGET_DISPLAY_NAME = 'Russell Liles';
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
