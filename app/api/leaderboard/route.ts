const TOURNAMENT_FEEDS: Record<string, { espnTournamentId: string }> = {
  players: { espnTournamentId: '401811937' },
  masters: { espnTournamentId: '401811941' },
  pga: { espnTournamentId: '401811947' },
  'us-open': { espnTournamentId: '401811952' },
  open: { espnTournamentId: '401811957' },
};

const TOURNAMENT_ODDS_PAGES: Record<string, string> = {
  players: 'https://www.oddschecker.com/us/golf/the-players-championship/winner',
  masters: 'https://www.oddschecker.com/us/golf/the-masters/winner',
  pga: 'https://www.oddschecker.com/us/golf/pga-championship/winner',
  'us-open': 'https://www.oddschecker.com/us/golf/us-open/winner',
  open: 'https://www.oddschecker.com/us/golf/the-open-championship/winner',
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

function extractWinnerSection(lines: string[]) {
  const winnerIndex = lines.findIndex((line) => line === 'Winner');

  if (winnerIndex < 0) {
    return lines;
  }

  const endIndex = lines.findIndex(
    (line, index) =>
      index > winnerIndex &&
      (line === 'Top 10 Finish' ||
        line === 'Top 5 Finish' ||
        line === 'Top 20 Finish' ||
        line === '1st Round Leader' ||
        line === 'Compare All Odds' ||
        line === 'Picks' ||
        line === 'More Insights'),
  );

  return lines.slice(winnerIndex, endIndex > winnerIndex ? endIndex : undefined);
}

function extractOddsFromSection(lines: string[]) {
  const americanOddsPattern = /^[+-]\d{2,5}$/;
  const section = extractWinnerSection(lines);
  const players: OddsRow[] = [];

  for (const watchedPlayer of WATCHED_PLAYERS) {
    const normalizedPlayer = normalizeName(watchedPlayer);
    const playerIndex = section.findIndex((line) => normalizeName(line) === normalizedPlayer);

    if (playerIndex < 0) {
      continue;
    }

    let foundOdds: string | null = null;

    for (let index = playerIndex + 1; index <= Math.min(playerIndex + 4, section.length - 1); index += 1) {
      const candidate = section[index];

      if (americanOddsPattern.test(candidate)) {
        foundOdds = candidate;
        break;
      }
    }

    if (!foundOdds) {
      continue;
    }

    players.push({
      canonicalName: watchedPlayer,
      odds: foundOdds,
    });
  }

  return players;
}

async function fetchLiveOdds(tournamentId: string) {
  const oddsPageUrl = TOURNAMENT_ODDS_PAGES[tournamentId];

  if (!oddsPageUrl) {
    return { source: 'Static odds fallback (no public odds page)', players: [] as OddsRow[] };
  }

  const response = await fetch(oddsPageUrl, {
    cache: 'no-store',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    return { source: `Static odds fallback (${response.status})`, players: [] as OddsRow[] };
  }

  const html = await response.text();
  const lines = htmlToLines(html);
  const players = extractOddsFromSection(lines);

  return {
    source: players.length ? 'Oddschecker public page scrape' : 'Static odds fallback (no matching scraped odds)',
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
