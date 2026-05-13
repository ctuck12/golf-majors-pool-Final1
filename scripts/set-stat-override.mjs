import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const KEY = 'pool-stat-overrides';

const overrideKey = 'masters:Sam Stevens';
const entry = {
  position: 'T24',
  score: 'F',   // finished (made cut)
  thru: 'F',
  statLine: {
    par: 41,
    birdie: 17,
    eagle: 0,
    albatross: 0,
    holeInOne: 0,
    bogey: 13,
    doubleBogey: 1,
    tripleOrWorse: 0,
  },
};

const raw = await redis.get(KEY);
const overrides = raw ? JSON.parse(raw) : {};
overrides[overrideKey] = entry;
await redis.set(KEY, JSON.stringify(overrides));

console.log(`Set stat override for "${overrideKey}":`, JSON.stringify(entry, null, 2));
await redis.quit();
