import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
// Akshay Bhatia=14, Bryson DeChambeau=15, Patrick Reed=90, Adam Scott=55, Jordan Spieth=10, Cameron Young=23
const MASTERS_ROSTER = [14, 15, 90, 55, 10, 23];
const TARGET_DISPLAY_NAME = 'Clayton Tucker';
const TOURNAMENT_ID = 'masters';

const raw = await redis.get(DB_KEY);
if (!raw) { console.error('No database found in Redis.'); process.exit(1); }

const db = JSON.parse(raw);
const user = db.users.find(u => u.displayName === TARGET_DISPLAY_NAME);
if (!user) { console.error(`User "${TARGET_DISPLAY_NAME}" not found.`); process.exit(1); }

user.rosters = user.rosters ?? {};
user.rosters[TOURNAMENT_ID] = MASTERS_ROSTER;

await redis.set(DB_KEY, JSON.stringify(db));
console.log(`Updated ${TARGET_DISPLAY_NAME}: Masters roster = [${MASTERS_ROSTER}]`);
await redis.quit();
