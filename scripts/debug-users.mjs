import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const raw = await redis.get('pool-database');
const db = JSON.parse(raw);

console.log(`Total users: ${db.users.length}`);
for (const user of db.users) {
  console.log(`\n  id: ${user.id}`);
  console.log(`  displayName: ${user.displayName}`);
  console.log(`  email: ${user.email}`);
  console.log(`  masters roster: ${JSON.stringify(user.rosters?.masters ?? null)}`);
  console.log(`  masters tiebreak: ${user.tieBreaks?.masters ?? null}`);
}

await redis.quit();
