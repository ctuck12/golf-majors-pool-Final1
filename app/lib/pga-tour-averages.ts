export type StatAverages = Record<string, string>;

// 2026 PGA Tour season averages (updated periodically)
// SG stats are always 0.000 by definition (relative to field)
const TOUR_AVERAGES: StatAverages = {
  drivingDistance: '298.4',
  drivingAccuracy: '61.9%',
  gir: '65.2%',
  scrambling: '59.1%',
  scoringAverage: '70.54',
  avgPuttsPerRound: '29.4',
};

export function fetchTourAverages(): StatAverages {
  return TOUR_AVERAGES;
}
