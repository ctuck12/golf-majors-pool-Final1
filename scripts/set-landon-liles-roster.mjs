import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
// Tommy Fleetwood=6, Viktor Hovland=17, Min Woo Lee=12, Hideki Matsuyama=8, Jon Rahm=16, Cameron Smith=28
const MASTERS_ROSTER = [6, 17, 12, 8, 16, 28];
const TIEBREAK = 276;
const TARGET_DISPLAY_NAME = 'Landon Liles';
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
