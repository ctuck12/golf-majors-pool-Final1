export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

// Test player: Scottie Scheffler
const TEST_PLAYER_NAME = 'Scottie Scheffler';
const TEST_PGA_TOUR_ID = '46046';
const TEST_ESPN_ID = '9478';
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

    // 1. playerProfileStats — attempt A: stats[] nested
    tryGql('pga_gql_playerProfileStats_A', `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            statTitle
            statName
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 2. playerProfileStats — attempt B: with year, categories[] nested
    tryGql('pga_gql_playerProfileStats_B', `
      query PlayerProfileStatsB($playerId: ID!, $year: Int) {
        playerProfileStats(playerId: $playerId, year: $year) {
          categories {
            statId
            statTitle
            statName
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID, year: 2026 }),

    // 3. playerProfileStats — attempt C: tourCode param, different nesting
    tryGql('pga_gql_playerProfileStats_C', `
      query PlayerProfileStatsC($playerId: ID!) {
        playerProfileStats(playerId: $playerId, tourCode: "R") {
          statDetails {
            statId
            statTitle
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 4. statLeaders — correct name per introspection, SG Total stat
    tryGql('pga_gql_statLeaders_sgTotal', `
      query StatLeaders($statId: ID!, $year: Int) {
        statLeaders(statId: $statId, year: $year) {
          statId
          statTitle
          leaders {
            playerId
            playerName
            statValue
            rank
          }
        }
      }
    `, { statId: '02674', year: 2026 }),

    // 5. statDetails — what does this return?
    tryGql('pga_gql_statDetails', `
      query StatDetails($statId: ID!, $playerId: ID!, $year: Int) {
        statDetails(statId: $statId, playerId: $playerId, year: $year) {
          statId
          statTitle
          statValue
          rank
        }
      }
    `, { statId: '02674', playerId: TEST_PGA_TOUR_ID, year: 2026 }),

    // 6. player — what fields does it actually have?
    tryGql('pga_gql_player_fields', `
      query Player($playerId: ID!) {
        player(id: $playerId) {
          id
          firstName
          lastName
          country
          owgr
          points
          ranking
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 7. Introspection — find return type of playerProfileStats
    tryGql('pga_gql_introspect_playerProfileStats_type', `
      {
        __schema {
          queryType {
            fields {
              name
              type {
                name
                kind
                ofType { name kind ofType { name kind } }
              }
              args {
                name
                type { name kind ofType { name kind } }
              }
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

    // 9. ESPN athlete overview (broader data)
    tryEspn('espn_athlete_overview',
      `https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${TEST_ESPN_ID}/overview`
    ),

  ]);

  const output = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
  );

  // Fire-and-forget cache write — does not block the response
  redis.setex('golf-stats-test-results', 3600, JSON.stringify(output)).catch(() => {});

  return Response.json({ testPlayer: TEST_PLAYER_NAME, pgaTourId: TEST_PGA_TOUR_ID, espnId: TEST_ESPN_ID, results: output }, { headers: { 'Cache-Control': 'no-store' } });
}
