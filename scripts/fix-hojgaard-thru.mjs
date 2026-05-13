import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const STAT_OVERRIDES_KEY = 'pool-stat-overrides';

const raw = await redis.get(STAT_OVERRIDES_KEY);
const overrides = raw ? JSON.parse(raw) : {};

overrides['masters:Nicolai Hojgaard'] = {
  position: 'CUT',
  thru: '--',
  statLine: {
    par: 19, birdie: 5, eagle: 1, albatross: 0, holeInOne: 0,
    bogey: 9, doubleBogey: 2, tripleOrWorse: 0, numRounds: 2,
  },
};

await redis.set(STAT_OVERRIDES_KEY, JSON.stringify(overrides));
console.log('Fixed: set thru="--" for masters:Nicolai Hojgaard stat override.');
await redis.quit();
