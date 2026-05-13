import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const sc = JSON.parse(await redis.get('scorecard-cache:masters') ?? '{}');
const players = sc.players ?? {};

for (const [playerId, data] of Object.entries(players)) {
  let totalStreaks = 0;
  for (const round of data.rounds ?? []) {
    let consecutive = 0;
    let roundStreaks = 0;
    for (const hole of round.holes ?? []) {
      if (hole.score - hole.par === -1) {
        consecutive++;
        if (consecutive === 3) { roundStreaks++; consecutive = 0; }
      } else {
        consecutive = 0;
      }
    }
    totalStreaks += roundStreaks;
  }
  if (totalStreaks > 0) {
    console.log(`${data.playerName}: ${totalStreaks} streak(s)`);
  }
}

await redis.quit();
