import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
const TARGET_DISPLAY_NAME = 'Zach Stewart';

const raw = await redis.get(DB_KEY);
if (!raw) { console.error('No database found in Redis.'); process.exit(1); }

const db = JSON.parse(raw);
const before = db.users.length;
db.users = db.users.filter(u => u.displayName !== TARGET_DISPLAY_NAME);
const after = db.users.length;

if (before === after) {
  console.error(`User "${TARGET_DISPLAY_NAME}" not found.`);
  process.exit(1);
}

await redis.set(DB_KEY, JSON.stringify(db));
console.log(`Removed "${TARGET_DISPLAY_NAME}" from pool database (${before} → ${after} users).`);
await redis.quit();
