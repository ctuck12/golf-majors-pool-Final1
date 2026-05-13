import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
const TOURNAMENT_ID = 'masters';

const raw = await redis.get(DB_KEY);
if (!raw) { console.error('No database found in Redis.'); process.exit(1); }

const db = JSON.parse(raw);
const pool = db.pools.find(p => p.id === 'golf-majors-pool');
if (!pool) { console.error('Pool not found.'); process.exit(1); }

pool.payouts = pool.payouts ?? {};
pool.payouts[TOURNAMENT_ID] = { first: 360, second: 175, third: 25 };

await redis.set(DB_KEY, JSON.stringify(db));
console.log(`Updated Masters payouts: 1st=$360, 2nd=$175, 3rd=$25`);
await redis.quit();
