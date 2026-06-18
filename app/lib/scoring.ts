export const SCORING_RULES = {
  tripleOrWorse: -5,
  doubleBogey: -3,
  bogey: -1,
  par: 0.5,
  birdie: 3,
  eagle: 8,
  albatross: 13,
  holeInOne: 10,
  threeBirdieStreak: 4,
  bogeyFreeRound: 5,
  tourneyLowRound: 6,
  firstRoundLeader: 5,
  secondRoundLeader: 5,
  thirdRoundLeader: 5,
  cutPlayer: -10,
} as const;

export const FINISH_POSITION_POINTS = [
  { max: 1, points: 40 },
  { max: 2, points: 25 },
  { max: 3, points: 20 },
  { max: 4, points: 18 },
  { max: 5, points: 16 },
  { max: 6, points: 14 },
  { max: 7, points: 12 },
  { max: 8, points: 10 },
  { max: 9, points: 9 },
  { max: 10, points: 8 },
  { max: 15, points: 7 },
  { max: 20, points: 6 },
  { max: 25, points: 5 },
  { max: 30, points: 3 },
  { max: 40, points: 1 },
] as const;

export type GolferScoreBreakdown = {
  holePoints: number;
  streakPoints: number;
  roundBonusPoints: number;
  placementPoints: number;
  cutPenaltyPoints: number;
  totalPoints: number;
  holesRemaining: number;
  madeCut: boolean | null;
  tiePosition: string;
  roundLeadersAwarded: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  statLine: {
    tripleOrWorse: number;
    doubleBogey: number;
    bogey: number;
    par: number;
    birdie: number;
    eagle: number;
    albatross: number;
    holeInOne: number;
    threeBirdieStreaks: number;
    bogeyFreeRounds: number;
    lowRounds: number;
  };
};

export function placementPoints(position: string | undefined) {
  if (!position) {
    return 0;
  }

  const numeric = Number(position.replace('T', ''));
  if (Number.isNaN(numeric)) {
    return 0;
  }

  const match = FINISH_POSITION_POINTS.find((rule) => numeric <= rule.max);
  return match?.points ?? 0;
}

export function normalizeTournamentScore(score: string | undefined) {
  if (!score || score === '--' || score === 'E') {
    return 0;
  }

  const numeric = Number(score);
  return Number.isNaN(numeric) ? 0 : numeric;
}

export function estimateHolesRemaining(thru: string | undefined, status: string | undefined, currentRound = 1) {
  if (status === 'CUT' || status === 'MDF' || status === 'WD' || status === 'DQ') {
    return 0;
  }

  const roundsLeft = 4 - currentRound;

  if (!thru || thru === '--') {
    // Haven't started current round yet — full remaining rounds including this one
    return (roundsLeft + 1) * 18;
  }

  if (thru === 'F') {
    // Finished current round — only future rounds remain
    return roundsLeft * 18;
  }

  const completedHoles = Number(thru);
  if (Number.isNaN(completedHoles)) {
    return (roundsLeft + 1) * 18;
  }

  return roundsLeft * 18 + Math.max(0, 18 - completedHoles);
}

export type ScorecardRound = {
  roundId: number;
  holes: Array<{ holeNumber: number; par: number; score: number }>;
};

export function computeFullScoreBreakdown(params: {
  position: string;
  score: string;
  thru: string;
  rounds: ScorecardRound[];
  roundLeadersAwarded: { first: boolean; second: boolean; third: boolean };
  tournamentLowRoundScore: number | null;
  currentRound?: number;
}): GolferScoreBreakdown {
  const hasStarted = params.thru && params.thru !== '--';
  const placement = ((params.currentRound ?? 1) === 1 && !hasStarted) ? 0 : placementPoints(params.position);
  const holesRemaining = estimateHolesRemaining(params.thru, params.score, params.currentRound ?? 1);

  const madeCut =
    params.score === 'CUT' || params.score === 'MDF'
      ? false
      : params.thru === 'F'
        ? true
        : null;
  const cutPenalty = madeCut === false ? SCORING_RULES.cutPlayer : 0;

  let tripleOrWorse = 0,
    doubleBogey = 0,
    bogey = 0,
    par = 0,
    birdie = 0,
    eagle = 0,
    albatross = 0,
    holeInOne = 0;
  let threeBirdieStreaks = 0;
  let bogeyFreeRounds = 0;
  let lowRounds = 0;
  const completedRoundTotals: number[] = [];

  for (const round of params.rounds) {
    if (!round.holes.length) continue;

    let roundBogeyFree = true;
    let consecutiveBirdies = 0;
    let roundTotal = 0;

    for (const hole of round.holes) {
      const diff = hole.score - hole.par;
      roundTotal += hole.score;

      if (hole.score === 1) {
        holeInOne++;
      } else if (diff <= -3) {
        albatross++;
      } else if (diff === -2) {
        eagle++;
      } else if (diff === -1) {
        birdie++;
      } else if (diff === 0) {
        par++;
      } else if (diff === 1) {
        bogey++;
        roundBogeyFree = false;
      } else if (diff === 2) {
        doubleBogey++;
        roundBogeyFree = false;
      } else {
        tripleOrWorse++;
        roundBogeyFree = false;
      }

      // 3-birdie streak: non-overlapping, resets after awarding
      if (diff === -1) {
        consecutiveBirdies++;
        if (consecutiveBirdies === 3) {
          threeBirdieStreaks++;
          consecutiveBirdies = 0;
        }
      } else {
        consecutiveBirdies = 0;
      }
    }

    if (roundBogeyFree && round.holes.length === 18) bogeyFreeRounds++;
    if (round.holes.length === 18) completedRoundTotals.push(roundTotal);
  }

  // Low round: player's 18-hole round matches the tournament low
  if (params.tournamentLowRoundScore !== null) {
    for (const total of completedRoundTotals) {
      if (total === params.tournamentLowRoundScore) lowRounds++;
    }
  }

  const holePoints =
    tripleOrWorse * SCORING_RULES.tripleOrWorse +
    doubleBogey * SCORING_RULES.doubleBogey +
    bogey * SCORING_RULES.bogey +
    par * SCORING_RULES.par +
    birdie * SCORING_RULES.birdie +
    eagle * SCORING_RULES.eagle +
    albatross * SCORING_RULES.albatross +
    holeInOne * SCORING_RULES.holeInOne;

  const streakPoints = threeBirdieStreaks * SCORING_RULES.threeBirdieStreak;

  const roundBonusPoints =
    bogeyFreeRounds * SCORING_RULES.bogeyFreeRound +
    lowRounds * SCORING_RULES.tourneyLowRound;

  const roundLeaderPoints =
    (params.roundLeadersAwarded.first ? SCORING_RULES.firstRoundLeader : 0) +
    (params.roundLeadersAwarded.second ? SCORING_RULES.secondRoundLeader : 0) +
    (params.roundLeadersAwarded.third ? SCORING_RULES.thirdRoundLeader : 0);

  const totalPoints =
    holePoints + streakPoints + roundBonusPoints + roundLeaderPoints + placement + cutPenalty;

  return {
    holePoints,
    streakPoints,
    roundBonusPoints: roundBonusPoints + roundLeaderPoints,
    placementPoints: placement,
    cutPenaltyPoints: cutPenalty,
    totalPoints,
    holesRemaining,
    madeCut,
    tiePosition: params.position,
    roundLeadersAwarded: params.roundLeadersAwarded,
    statLine: {
      tripleOrWorse,
      doubleBogey,
      bogey,
      par,
      birdie,
      eagle,
      albatross,
      holeInOne,
      threeBirdieStreaks,
      bogeyFreeRounds,
      lowRounds,
    },
  };
}

export function buildPlaceholderScoreBreakdown(params: {
  position: string;
  score: string;
  thru: string;
  currentRound?: number;
}) {
  const hasStarted = params.thru && params.thru !== '--';
  const placement = ((params.currentRound ?? 1) === 1 && !hasStarted) ? 0 : placementPoints(params.position);
  const holesRemaining = estimateHolesRemaining(params.thru, params.score, params.currentRound ?? 1);
  const madeCut =
    params.score === 'CUT' || params.score === 'MDF'
      ? false
      : params.thru === 'F'
        ? true
        : null;
  const cutPenalty = madeCut === false ? SCORING_RULES.cutPlayer : 0;
  const totalPoints = placement + cutPenalty;

  return {
    holePoints: 0,
    streakPoints: 0,
    roundBonusPoints: 0,
    placementPoints: placement,
    cutPenaltyPoints: cutPenalty,
    totalPoints,
    holesRemaining,
    madeCut,
    tiePosition: params.position,
    roundLeadersAwarded: {
      first: false,
      second: false,
      third: false,
    },
    statLine: {
      tripleOrWorse: 0,
      doubleBogey: 0,
      bogey: 0,
      par: 0,
      birdie: 0,
      eagle: 0,
      albatross: 0,
      holeInOne: 0,
      threeBirdieStreaks: 0,
      bogeyFreeRounds: 0,
      lowRounds: 0,
    },
  } satisfies GolferScoreBreakdown;
}
