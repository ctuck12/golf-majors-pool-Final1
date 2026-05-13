import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const LEADERBOARD_KEY = 'leaderboard-cache:masters';
const SCORECARD_KEY = 'scorecard-cache:masters';
const STAT_OVERRIDES_KEY = 'pool-stat-overrides';

// 19 pars, 5 birdies, 1 eagle, 9 bogeys, 2 doubles = 36 holes = 2 rounds (CUT)
// Round 1: 1 eagle, 2 birdies, 10 pars, 4 bogeys, 1 double = 18
// Round 2: 3 birdies interleaved (B,P,B,P,B,...), 9 pars, 5 bogeys, 1 double = 18
// Birdies in R2 are interleaved so no 3 consecutive birdie streak is triggered
function buildTwoRoundScorecard() {
  // R1: Eagle(par5), Birdie, Par, Birdie, Par×9, Bogey×4, Double
  //     Eagle resets streak; 2 birdies never consecutive → no streak
  // R2: Birdie, Par, Birdie, Par, Birdie, Par×7, Bogey×5, Double
  //     Birdies separated by pars → no streak
  const rounds = [
    // E  B  P  B  P  P  P  P  P  P  P  P  P  Bog Bog Bog Bog  Dbl
    [
      { par: 5, score: 3 }, // eagle
      { par: 4, score: 3 }, // birdie
      { par: 4, score: 4 }, // par
      { par: 4, score: 3 }, // birdie
      ...Array(9).fill({ par: 4, score: 4 }),  // 9 pars
      ...Array(4).fill({ par: 4, score: 5 }),  // 4 bogeys
      { par: 4, score: 6 },                    // double
    ],
    // B  P  B  P  B  P  P  P  P  P  P  P  Bog Bog Bog Bog Bog  Dbl
    [
      { par: 4, score: 3 }, // birdie
      { par: 4, score: 4 }, // par
      { par: 4, score: 3 }, // birdie
      { par: 4, score: 4 }, // par
      { par: 4, score: 3 }, // birdie
      ...Array(7).fill({ par: 4, score: 4 }),  // 7 pars
      ...Array(5).fill({ par: 4, score: 5 }),  // 5 bogeys
      { par: 4, score: 6 },                    // double
    ],
  ];
  return rounds.map((holes, idx) => ({
    roundId: idx + 1,
    holes: holes.map((h, i) => ({ holeNumber: i + 1, par: h.par, score: h.score })),
  }));
}

function normName(n) {
  return n.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const lbRaw = await redis.get(LEADERBOARD_KEY);
if (!lbRaw) { console.error('No Masters leaderboard cache found in Redis.'); process.exit(1); }

const lb = JSON.parse(lbRaw);
const rows = lb.leaderboard ?? [];
const row = rows.find(r => normName(`${r.firstName} ${r.lastName}`) === normName('Nicolai Hojgaard'));

if (row) {
  console.log(`Found Nicolai Hojgaard: playerId=${row.playerId}, status=${row.status}, thru=${row.thru}`);

  const scRaw = await redis.get(SCORECARD_KEY);
  const sc = scRaw ? JSON.parse(scRaw) : { players: {}, lastCompletedRound: 0 };
  sc.players[row.playerId] = {
    playerId: row.playerId,
    playerName: 'Nicolai Hojgaard',
    rounds: buildTwoRoundScorecard(),
    refreshedAt: new Date().toISOString(),
  };
  await redis.set(SCORECARD_KEY, JSON.stringify(sc));
  console.log('Injected 2-round scorecard into scorecard cache.');

} else {
  console.log('Nicolai Hojgaard NOT in Masters leaderboard — falling back to stat override (numRounds=2).');

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
  console.log('Set stat override for masters:Nicolai Hojgaard (numRounds=2).');
}

await redis.quit();
