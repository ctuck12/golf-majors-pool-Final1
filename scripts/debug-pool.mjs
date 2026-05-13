import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const raw = await redis.get('pool-database');
const db = JSON.parse(raw);

const pool = db.pools[0];
console.log('Pool id:', pool.id);
console.log('Pool memberUserIds:', pool.memberUserIds);

// Find Clayton Tucker
const ct = db.users.find(u => u.displayName === 'Clayton Tucker');
console.log('\nClayton Tucker id:', ct?.id);
console.log('Is in pool:', pool.memberUserIds.includes(ct?.id));
console.log('Masters roster stored in db:', JSON.stringify(ct?.rosters?.masters));

// Also show what getSessionContext would return for entries
const entryForCT = pool.memberUserIds.includes(ct?.id)
  ? { id: ct.id, name: ct.displayName, rosters: ct.rosters, tieBreaks: ct.tieBreaks }
  : null;
console.log('\nEntry object that API would return for Clayton Tucker:');
console.log(JSON.stringify(entryForCT, null, 2));

await redis.quit();
