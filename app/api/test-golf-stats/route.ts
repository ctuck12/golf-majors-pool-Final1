export const dynamic = 'force-dynamic';

// Test player: Scottie Scheffler
const TEST_PLAYER_NAME = 'Scottie Scheffler';
const TEST_PGA_TOUR_ID = '46046';
const TEST_ESPN_ID = '4848'; // via getEspnId override
// The Open Championship ESPN event ID (upcoming, so good for testing tournament stats)
const TEST_ESPN_EVENT_ID = '401811952'; // US Open 2026

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

async function tryGql(label: string, query: string, variables: Record<string, unknown>) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    return { label, status: res.status, ok: res.ok, data: json };
  } catch (e) {
    return { label, error: String(e) };
  }
}

async function tryEspn(label: string, url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) } as RequestInit);
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    return { label, status: res.status, ok: res.ok, url, data: json };
  } catch (e) {
    return { label, url, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.allSettled([

    // ── PGA Tour GraphQL queries ──────────────────────────────────────────────

    // 1. Season player stats (most common query structure)
    tryGql('pga_gql_playerStats', `
      query PlayerStats($playerId: ID!, $year: Int) {
        playerStats(playerId: $playerId, year: $year) {
          playerId
          year
          stats {
            statId
            statType
            statTitle
            statDescription
            statName
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID, year: 2026 }),

    // 2. Player profile statistics (alternative schema)
    tryGql('pga_gql_playerProfileStatistics', `
      query PlayerProfileStatistics($playerId: ID!) {
        playerProfileStatistics(playerId: $playerId) {
          playerId
          statsYear
          stats {
            statId
            statType
            statTitle
            statName
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 3. Stat leaders (driving distance 101) — returns ranked list
    tryGql('pga_gql_statLeaderboard_drivingDist', `
      query StatLeaderboard($statId: ID!, $year: Int) {
        statLeaderboard(statId: $statId, year: $year) {
          statId
          statTitle
          statDescription
          rows {
            playerId
            playerName
            value
            rank
          }
        }
      }
    `, { statId: '101', year: 2026 }),

    // 4. Tournament-specific player stats
    tryGql('pga_gql_tournamentPlayerStats', `
      query TournamentPlayerStats($tournamentId: ID!, $playerId: ID!, $year: Int) {
        tournamentStats(tournamentId: $tournamentId, year: $year) {
          playerId
          stats {
            statId
            statTitle
            statName
            statValue
          }
        }
      }
    `, { tournamentId: '026', playerId: TEST_PGA_TOUR_ID, year: 2026 }),

    // 5. Player tournament stats (alternative)
    tryGql('pga_gql_playerTournamentStats', `
      query PlayerTournamentStats($playerId: ID!, $tournamentId: ID!, $year: Int) {
        playerTournamentStatistics(playerId: $playerId, tournamentId: $tournamentId, year: $year) {
          stats {
            statId
            statTitle
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID, tournamentId: '026', year: 2026 }),

    // 6. Player details (see what top-level player query returns)
    tryGql('pga_gql_player', `
      query Player($playerId: ID!) {
        player(id: $playerId) {
          id
          firstName
          lastName
          country
          careerEarnings
          fedexPoints
          owgr
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 7. Introspection — list available query types
    tryGql('pga_gql_introspection_queryType', `
      query {
        __schema {
          queryType {
            fields {
              name
              description
            }
          }
        }
      }
    `, {}),

    // ── ESPN stats endpoints ──────────────────────────────────────────────────

    // 8. ESPN season statistics for Scheffler
    tryEspn('espn_season_stats',
      `${ESPN_CORE}/pga/seasons/2026/athletes/${TEST_ESPN_ID}/statistics`
    ),

    // 9. ESPN tournament competitor statistics (US Open)
    tryEspn('espn_tournament_competitor_stats',
      `${ESPN_CORE}/pga/events/${TEST_ESPN_EVENT_ID}/competitions/${TEST_ESPN_EVENT_ID}/competitors/${TEST_ESPN_ID}/statistics`
    ),

    // 10. ESPN athlete overview (broader data)
    tryEspn('espn_athlete_overview',
      `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${TEST_ESPN_ID}/overview`
    ),

    // 11. ESPN athlete stats page
    tryEspn('espn_athlete_stats',
      `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${TEST_ESPN_ID}/stats`
    ),

  ]);

  const output = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
  );

  return Response.json({ testPlayer: TEST_PLAYER_NAME, pgaTourId: TEST_PGA_TOUR_ID, espnId: TEST_ESPN_ID, results: output }, { headers: { 'Cache-Control': 'no-store' } });
}
