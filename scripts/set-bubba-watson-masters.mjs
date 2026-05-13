import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });

const LEADERBOARD_KEY = 'leaderboard-cache:masters';
const SCORECARD_KEY = 'scorecard-cache:masters';
const STAT_OVERRIDES_KEY = 'pool-stat-overrides';

// 19 pars, 6 birdies, 11 bogeys = 36 holes = 2 rounds (CUT after R2)
// Round 1: 10 pars, 3 birdies, 5 bogeys = 18 holes
// Round 2:  9 pars, 3 birdies, 6 bogeys = 18 holes
// Birdies interleaved (B,P,B,P,B,...) so no 3 consecutive birdie streak is triggered
function buildTwoRoundScorecard() {
  // Each sequence: birdie, par, birdie, par, birdie, then remaining pars then bogeys
  const rounds = [
    // B P B P B P P P P P P P Bog Bog Bog Bog Bog P  = 3B 10P 5Bog
    [3,4,3,4,3,4,4,4,4,4,4,4,5,5,5,5,5,4],
    // B P B P B P P P P P P P Bog Bog Bog Bog Bog Bog = 3B 9P 6Bog
    [3,4,3,4,3,4,4,4,4,4,4,4,5,5,5,5,5,5],
  ];
  return rounds.map((scores, idx) => ({
    roundId: idx + 1,
    holes: scores.map((score, i) => ({ holeNumber: i + 1, par: 4, score })),
  }));
}

function normName(n) {
  return n.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── 1. Check leaderboard cache for Bubba Watson ───────────────────────────
const lbRaw = await redis.get(LEADERBOARD_KEY);
if (!lbRaw) { console.error('No Masters leaderboard cache found in Redis.'); process.exit(1); }

const lb = JSON.parse(lbRaw);
const rows = lb.leaderboard ?? [];
const bubbaRow = rows.find(r => normName(`${r.firstName} ${r.lastName}`) === normName('Bubba Watson'));

if (bubbaRow) {
  console.log(`Found Bubba Watson: playerId=${bubbaRow.playerId}, status=${bubbaRow.status}, thru=${bubbaRow.thru}`);

  // Inject 2-round scorecard directly into the scorecard cache
  const scRaw = await redis.get(SCORECARD_KEY);
  const sc = scRaw ? JSON.parse(scRaw) : { players: {}, lastCompletedRound: 0 };
  sc.players[bubbaRow.playerId] = {
    playerId: bubbaRow.playerId,
    playerName: 'Bubba Watson',
    rounds: buildTwoRoundScorecard(),
    refreshedAt: new Date().toISOString(),
  };
  await redis.set(SCORECARD_KEY, JSON.stringify(sc));
  console.log('Injected 2-round scorecard into scorecard cache.');

} else {
  console.log('Bubba Watson NOT in Masters leaderboard cache — falling back to stat override (numRounds=2).');

  const raw = await redis.get(STAT_OVERRIDES_KEY);
  const overrides = raw ? JSON.parse(raw) : {};
  overrides['masters:Bubba Watson'] = {
    position: 'CUT',
    thru: 'F',
    statLine: {
      par: 19,
      birdie: 6,
      eagle: 0,
      albatross: 0,
      holeInOne: 0,
      bogey: 11,
      doubleBogey: 0,
      tripleOrWorse: 0,
      numRounds: 2,
    },
  };
  await redis.set(STAT_OVERRIDES_KEY, JSON.stringify(overrides));
  console.log('Set stat override for masters:Bubba Watson (numRounds=2).');
}

await redis.quit();
