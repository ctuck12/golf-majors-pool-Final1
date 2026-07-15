import { isAuthEnabled, isAuthed } from '../../../lib/budget/auth';
import { isPlaidConfigured, plaidEnv } from '../../../lib/budget/plaid';
import { getItems } from '../../../lib/budget/store';

export async function GET() {
  const authed = await isAuthed();
  const items = authed ? await getItems() : [];
  return Response.json({
    authEnabled: isAuthEnabled(),
    authed,
    plaidConfigured: isPlaidConfigured(),
    plaidEnv: plaidEnv(),
    hasData: items.length > 0,
    hasDemoData: items.some((i) => i.demo),
  });
}
