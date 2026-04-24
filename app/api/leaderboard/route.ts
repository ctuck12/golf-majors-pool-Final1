const TOURNAMENT_FEEDS: Record<string, { espnTournamentId: string }> = {
  players: { espnTournamentId: '401811937' },
  masters: { espnTournamentId: '401811941' },
  pga: { espnTournamentId: '401811947' },
  'us-open': { espnTournamentId: '401811952' },
  open: { espnTournamentId: '401811957' },
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
    tournamentId,
    status,
    fetchedAt: new Date().toISOString(),
    players,
  });
}
