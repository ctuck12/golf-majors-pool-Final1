export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

// Test player: Scottie Scheffler
const TEST_PLAYER_NAME = 'Scottie Scheffler';
const TEST_PGA_TOUR_ID = '46046';
const TEST_ESPN_ID = '9478';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const ESPN_EVENT_MASTERS = '401811941';
const ESPN_EVENT_USOPEN = '401811952';

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

    // ── ESPN Core: direct competition stats (no recency window) ───────────────

    // 1. Masters stats for Scheffler via direct ESPN Core competitor endpoint
    tryEspn('espn_core_masters_competitor_stats',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors/${TEST_ESPN_ID}/statistics/0`
    ),

    // 2. US Open stats for Scheffler via direct ESPN Core competitor endpoint
    tryEspn('espn_core_usopen_competitor_stats',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/competitors/${TEST_ESPN_ID}/statistics/0`
    ),

    // 3. Masters linescores for Scheffler
    tryEspn('espn_core_masters_linescores',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors/${TEST_ESPN_ID}/linescores`
    ),

    // 4. US Open linescores for Scheffler
    tryEspn('espn_core_usopen_linescores',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_USOPEN}/competitions/${ESPN_EVENT_USOPEN}/competitors/${TEST_ESPN_ID}/linescores`
    ),

    // 5. Masters competitors list — verify competitor ID format (is it the ESPN athlete ID?)
    tryEspn('espn_core_masters_competitors_list',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}/competitors?limit=5`
    ),

    // 6. Masters competition info
    tryEspn('espn_core_masters_competition',
      `${ESPN_CORE}/pga/events/${ESPN_EVENT_MASTERS}/competitions/${ESPN_EVENT_MASTERS}`
    ),

    // ── PGA Tour GQL: tournament-specific stats ───────────────────────────────

    // 7. Introspect playerProfileTournamentResults type
    tryGql('pga_gql_introspect_tournamentResults', `
      {
        __type(name: "PlayerProfileTournamentResults") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 8. playerProfileTournamentResults — attempt with nested events
    tryGql('pga_gql_tournamentResults_A', `
      query TournamentResults($playerId: ID!) {
        playerProfileTournamentResults(playerId: $playerId) {
          events {
            tournamentName
            tournamentId
            season
            rounds
            position
            strokes
            scoreToPar
            earnings
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 9. playerProfileTournamentResults — minimal fields probe
    tryGql('pga_gql_tournamentResults_B', `
      query TournamentResultsB($playerId: ID!) {
        playerProfileTournamentResults(playerId: $playerId) {
          __typename
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 10. Introspect playerProfileCourseResults type
    tryGql('pga_gql_introspect_courseResults', `
      {
        __type(name: "PlayerProfileCourseResults") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 11. Introspect PlayerProfileStatItem — find actual field names
    tryGql('pga_gql_introspect_statItem', `
      {
        __type(name: "PlayerProfileStatItem") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 12. playerProfileStats — direct list (no stats{} wrapper), known fields
    tryGql('pga_gql_playerProfileStats_direct', `
      query PlayerProfileStatsDirect($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          statId
          statTitle
          statName
          statValue
          rank
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 13. playerProfileStats — alternate field names probe
    tryGql('pga_gql_playerProfileStats_altFields', `
      query PlayerProfileStatsAlt($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          __typename
          statId
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 14. ESPN Core: season athlete statistics
    tryEspn('espn_core_season_stats',
      `${ESPN_CORE}/pga/seasons/2026/athletes/${TEST_ESPN_ID}/statistics`
    ),

  ]);

  const output = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { error: String(r.reason) }
  );

  redis.setex('golf-stats-test-results', 3600, JSON.stringify(output)).catch(() => {});

  return Response.json({
    testPlayer: TEST_PLAYER_NAME,
    pgaTourId: TEST_PGA_TOUR_ID,
    espnId: TEST_ESPN_ID,
    espnEventMasters: ESPN_EVENT_MASTERS,
    espnEventUsOpen: ESPN_EVENT_USOPEN,
    results: output,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
