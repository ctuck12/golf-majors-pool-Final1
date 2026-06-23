import { fetchTourAverages } from '@/app/lib/pga-tour-averages';

export function GET() {
  return Response.json({ averages: fetchTourAverages() });
}
