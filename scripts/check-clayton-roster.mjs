import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const DB_KEY = 'pool-database';
const raw = await redis.get(DB_KEY);
const db = JSON.parse(raw);
const user = db.users.find(u => u.displayName === 'Clayton Tucker');
console.log('Masters roster IDs:', user?.rosters?.masters);
console.log('Masters tiebreak:', user?.tieBreaks?.masters);
await redis.quit();
