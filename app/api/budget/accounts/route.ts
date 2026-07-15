import { requireAuth } from '../../../lib/budget/auth';
import { getAccounts, getItems } from '../../../lib/budget/store';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const [accounts, items] = await Promise.all([getAccounts(), getItems()]);
  const safeItems = items.map((item) => {
    const copy = { ...item };
    delete copy.accessToken;
    return copy;
  });
  return Response.json({ accounts, items: safeItems });
}
