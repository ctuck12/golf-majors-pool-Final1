import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });
const names = (process.env.PLAYERS ?? '').split(',').map(s => s.trim().toLowerCase());

const sc = JSON.parse(await redis.get('scorecard-cache:masters') ?? '{}');

for (const [, data] of Object.entries(sc.players ?? {})) {
  if (names.length && !names.includes(data.playerName?.toLowerCase())) continue;
  console.log(`\n=== ${data.playerName} ===`);
  for (const round of data.rounds ?? []) {
    let consecutive = 0, streaks = 0;
    const holeLog = round.holes.map(h => {
      const diff = h.score - h.par;
      const label = diff <= -3 ? 'ALB' : diff === -2 ? 'EAG' : diff === -1 ? 'BIR' : diff === 0 ? 'PAR' : diff === 1 ? 'BOG' : diff === 2 ? 'DBL' : 'TPL';
      if (diff === -1) { consecutive++; if (consecutive === 3) { streaks++; consecutive = 0; } }
      else consecutive = 0;
      return label;
    }).join(' ');
    console.log(`  R${round.roundId} (${streaks} streak): ${holeLog}`);
  }
}

await redis.quit();
