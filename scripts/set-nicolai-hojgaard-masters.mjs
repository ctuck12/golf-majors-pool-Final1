import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const LEADERBOARD_KEY = 'leaderboard-cache:masters';
const SCORECARD_KEY = 'scorecard-cache:masters';
const STAT_OVERRIDES_KEY = 'pool-stat-overrides';

// 19 pars, 5 birdies, 1 eagle, 9 bogeys, 2 doubles = 36 holes = 2 rounds (CUT)
// Round 1: 1 eagle, 2 birdies, 10 pars, 4 bogeys, 1 double = 18
// Round 2: 0 eagles, 3 birdies,  9 pars, 5 bogeys, 1 double = 18
function buildTwoRoundScorecard() {
  const rounds = [
    { eagles: 1, birdies: 2, pars: 10, bogeys: 4, doubles: 1 },
    { eagles: 0, birdies: 3, pars:  9, bogeys: 5, doubles: 1 },
  ];
  return rounds.map(({ eagles, birdies, pars, bogeys, doubles }, idx) => {
    const holes = [];
    let n = 1;
    for (let i = 0; i < eagles;  i++) holes.push({ holeNumber: n++, par: 5, score: 3 });
    for (let i = 0; i < birdies; i++) holes.push({ holeNumber: n++, par: 4, score: 3 });
    for (let i = 0; i < pars;    i++) holes.push({ holeNumber: n++, par: 4, score: 4 });
    for (let i = 0; i < bogeys;  i++) holes.push({ holeNumber: n++, par: 4, score: 5 });
    for (let i = 0; i < doubles; i++) holes.push({ holeNumber: n++, par: 4, score: 6 });
    return { roundId: idx + 1, holes };
  });
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
    thru: 'F',
    statLine: {
      par: 19, birdie: 5, eagle: 1, albatross: 0, holeInOne: 0,
      bogey: 9, doubleBogey: 2, tripleOrWorse: 0, numRounds: 2,
    },
  };
  await redis.set(STAT_OVERRIDES_KEY, JSON.stringify(overrides));
  console.log('Set stat override for masters:Nicolai Hojgaard (numRounds=2).');
}

await redis.quit();
