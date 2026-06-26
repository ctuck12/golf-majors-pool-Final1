import { fetchPlayerSeasonStats } from './espn-player-stats';

export type StatAverages = Record<string, string>;

// statAvgs labels from espn-player-stats → StatAverages keys
const LABEL_TO_KEY: Record<string, string> = {
  'Drive Dist': 'drivingDistance',
  'Drive Acc': 'drivingAccuracy',
  'GIR%': 'gir',
  'Scrambling%': 'scrambling',
  'Sand Saves%': 'sandSaves',
  'Putts/Round': 'avgPuttsPerRound',
};

export async function fetchTourAverages(): Promise<StatAverages> {
  try {
    // fetchPlayerSeasonStats already parses ESPN overview and extracts statAvgs,
    // which contains tour averages from ESPN's averageDisplayValue field
    const stats = await fetchPlayerSeasonStats('Rory McIlroy');
    const statAvgs = stats?.statAvgs ?? {};
    const results: StatAverages = {};
    for (const [label, key] of Object.entries(LABEL_TO_KEY)) {
      const val = statAvgs[label];
      if (val) {
        console.log(`[tour-avg] key=${key} label=${label} value=${val}`);
        results[key] = val;
      }
    }
    return results;
  } catch (err) {
    console.log(`[tour-avg] failed: ${err}`);
    return {};
  }
}
