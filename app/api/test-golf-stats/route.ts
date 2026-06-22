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

    // 7. Introspect the Query type — find playerProfileStats return type
    tryGql('pga_gql_introspect_query_type', `
      {
        __type(name: "Query") {
          fields {
            name
            type { name kind ofType { name kind ofType { name kind } } }
          }
        }
      }
    `, {}),

    // 8. Introspect PlayerProfileStatItem — find actual field names
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

    // 9. Introspect PlayerProfileStats (wrapper type, has stats sub-field)
    tryGql('pga_gql_introspect_statWrapper', `
      {
        __type(name: "PlayerProfileStats") {
          name
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `, {}),

    // 10. playerProfileStats with stats{} wrapper — minimal __typename only
    tryGql('pga_gql_stats_typename_only', `
      query StatsTypename($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            __typename
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 11. playerProfileStats with stats{} wrapper — probe set A: statId, statTitle, statValue, rank
    tryGql('pga_gql_stats_probe_A', `
      query StatsProbeA($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            statTitle
            statValue
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 12. playerProfileStats with stats{} wrapper — probe set B: id, title, value, rank
    tryGql('pga_gql_stats_probe_B', `
      query StatsProbeB($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            id
            title
            value
            rank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 13. playerProfileStats with stats{} wrapper — probe set C: statId, name, displayValue, statRank
    tryGql('pga_gql_stats_probe_C', `
      query StatsProbeC($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            name
            displayValue
            statRank
          }
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 14. playerProfileStats without stats{} wrapper — direct list probe
    tryGql('pga_gql_stats_direct_probe', `
      query StatsDirectProbe($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          __typename
          statId
        }
      }
    `, { playerId: TEST_PGA_TOUR_ID }),

    // 15. ESPN Core: season athlete statistics
    tryEspn('espn_core_season_stats',
      `${ESPN_CORE}/pga/seasons/2026/athletes/${TEST_ESPN_ID}/statistics`
    ),

    // 16. ESPN Core: 2026 PGA Tour events list (to find The Players event ID)
    tryEspn('espn_core_2026_events',
      `${ESPN_CORE}/pga/seasons/2026/types/2/events?limit=50`
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
