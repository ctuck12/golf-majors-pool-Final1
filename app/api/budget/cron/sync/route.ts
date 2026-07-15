// Scheduled safety net behind Plaid webhooks (see vercel.json crons).
// If CRON_SECRET is set, Vercel sends it as a Bearer token — enforce it.
import { syncAllItems } from '../../../../lib/budget/sync';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const results = await syncAllItems();
  return Response.json({ results });
}
