const TOURNAMENT_FEEDS: Record<string, { espnTournamentId: string }> = {
  players: { espnTournamentId: '401811937' },
  masters: { espnTournamentId: '401811941' },
  pga: { espnTournamentId: '401811947' },
  'us-open': { espnTournamentId: '401811952' },
  open: { espnTournamentId: '401811957' },
};

const ODDS_SPORT_KEYS: Record<string, string | undefined> = {
  players: undefined,
  masters: 'golf_masters_tournament_winner',
  pga: 'golf_pga_championship_winner',
  'us-open': 'golf_us_open_winner',
  open: 'golf_the_open_championship_winner',
};

const WATCHED_PLAYERS = [
  'Scottie Scheffler',
  'Rory McIlroy',
  'Xander Schauffele',
  'Collin Morikawa',
  'Ludvig Aberg',
  'Tommy Fleetwood',
  'Patrick Cantlay',
  'Hideki Matsuyama',
  'Brooks Koepka',
  'Jordan Spieth',
  'Will Zalatoris',
  'Min Woo Lee',
  'Sahith Theegala',
  'Akshay Bhatia',
];

type LeaderboardRow = {
  position: string;
  name: string;
  score: string;
  thru: string;
  total?: string;
};

type OddsRow = {
  canonicalName: string;
  odds: string;
};

const SCORE_TOKEN = /^(E|CUT|WD|DQ|MDF|[+-]\d+)$/i;

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function decodeHtml(value: string) {
  const decoded = value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  if (decoded.includes('Ãƒ')) {
    try {
      return Buffer.from(decoded, 'latin1').toString('utf8');
    } catch {
      return decoded;
    }
  }

  return decoded;
}

function htmlToLines(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const blockBreaks = withoutScripts.replace(
    /<\/(tr|table|thead|tbody|p|div|li|ul|ol|section|article|header|footer|h1|h2|h3|h4|h5|br)>/gi,
    '\n',
  );

  return decodeHtml(blockBreaks)
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseRow(line: string): LeaderboardRow | null {
  const tokens = line.split(' ');
  if (tokens.length < 4) {
    return null;
  }

  const position = tokens.shift();
  if (!position || !/^(T?\d+)$/.test(position)) {
    return null;
  }

  const scoreIndex = tokens.findIndex((token) => SCORE_TOKEN.test(token));
  if (scoreIndex < 1) {
    return null;
  }

  const nameTokens = tokens.slice(0, scoreIndex);
  const score = tokens[scoreIndex];
  const rest = tokens.slice(scoreIndex + 1);
  const name = nameTokens.join(' ').replace(/^Image:\s*/i, '').trim();

  if (!name) {
    return null;
  }

  let thru = '--';
  if (rest.length >= 7) {
    thru = rest[1];
  } else if (rest.length >= 5) {
    thru = 'F';
  }

  const total = rest.length ? rest[rest.length - 1] : undefined;

  return {
    position,
    name,
    score,
    thru,
    total,
  };
}

function findStatus(lines: string[]) {
  const statusLine = lines.find(
    (line) =>
      line === 'Final' ||
      line.includes('In Progress') ||
      line.includes('Play Complete') ||
      line.includes('Tournament Field') ||
      line.includes('No Tournament Data Available'),
  );

  return statusLine ?? 'Status unavailable';
}

function americanOddsToProbability(price: number) {
  if (price === 0) {
    return 0;
  }

  if (price > 0) {
    return 100 / (price + 100);
  }

  return Math.abs(price) / (Math.abs(price) + 100);
}

function probabilityToAmericanOdds(probability: number) {
  if (probability <= 0 || probability >= 1) {
    return null;
  }

  if (probability < 0.5) {
    return Math.round((100 * (1 - probability)) / probability);
  }

  return -Math.round((100 * probability) / (1 - probability));
}

function formatAmericanOdds(price: number | null) {
  if (price === null || Number.isNaN(price)) {
    return null;
  }

  return price > 0 ? `+${price}` : `${price}`;
}

async function fetchLiveOdds(tournamentId: string) {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = ODDS_SPORT_KEYS[tournamentId];

  if (!apiKey || !sportKey) {
    return { source: apiKey ? 'Static odds fallback' : 'Static odds fallback (no ODDS_API_KEY)', players: [] as OddsRow[] };
  }

  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?regions=us&markets=outrights&oddsFormat=american&apiKey=${apiKey}`,
    {
      cache: 'no-store',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    },
  );

  if (!response.ok) {
    return { source: `Static odds fallback (${response.status})`, players: [] as OddsRow[] };
  }

  const payload = (await response.json()) as Array<{
    bookmakers?: Array<{
      markets?: Array<{
        key?: string;
        outcomes?: Array<{
          name?: string;
          price?: number;
        }>;
      }>;
    }>;
  }>;

  const probabilityBuckets = new Map<string, number[]>();

  for (const event of payload) {
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (market.key !== 'outrights') {
          continue;
        }

        for (const outcome of market.outcomes ?? []) {
          if (!outcome.name || typeof outcome.price !== 'number') {
            continue;
          }

          const canonicalName = WATCHED_PLAYERS.find(
            (playerName) => normalizeName(playerName) === normalizeName(outcome.name ?? ''),
          );

          if (!canonicalName) {
            continue;
          }

          const probability = americanOddsToProbability(outcome.price);
          if (probability <= 0) {
            continue;
          }

          const values = probabilityBuckets.get(canonicalName) ?? [];
          values.push(probability);
          probabilityBuckets.set(canonicalName, values);
        }
      }
    }
  }

  const players = Array.from(probabilityBuckets.entries())
    .map(([canonicalName, probabilities]) => {
      const averageProbability =
        probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length;
      const consensusOdds = formatAmericanOdds(probabilityToAmericanOdds(averageProbability));

      if (!consensusOdds) {
        return null;
      }

      return {
        canonicalName,
        odds: consensusOdds,
      };
    })
    .filter((row): row is OddsRow => Boolean(row));

  return {
    source: players.length ? 'The Odds API consensus odds' : 'Static odds fallback (no matching live odds)',
    players,
  };
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'players';
  const feed = TOURNAMENT_FEEDS[tournamentId];

  if (!feed) {
    return Response.json({ error: 'Unknown tournament id.' }, { status: 400 });
  }

  const response = await fetch(
    `https://www.espn.com/golf/leaderboard?tournamentId=${feed.espnTournamentId}`,
    {
      cache: 'no-store',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    },
  );

  if (!response.ok) {
    return Response.json(
      { error: `Unable to reach leaderboard source (${response.status}).` },
      { status: 502 },
    );
  }

  const html = await response.text();
  const lines = htmlToLines(html);
  const status = findStatus(lines);
  const liveOdds = await fetchLiveOdds(tournamentId);

  const rows = lines
    .map(parseRow)
    .filter((row): row is LeaderboardRow => Boolean(row));

  const watched = new Map(
    WATCHED_PLAYERS.map((playerName) => [normalizeName(playerName), playerName]),
  );

  const players = rows
    .filter((row) => watched.has(normalizeName(row.name)))
    .map((row) => ({
      ...row,
      canonicalName: watched.get(normalizeName(row.name)),
    }));

  return Response.json({
    source: 'ESPN leaderboard',
    oddsSource: liveOdds.source,
    tournamentId,
    status,
    fetchedAt: new Date().toISOString(),
    players,
    odds: liveOdds.players,
  });
}
