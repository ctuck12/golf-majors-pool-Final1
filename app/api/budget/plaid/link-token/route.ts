import { requireAuth } from '../../../../lib/budget/auth';
import { createLinkToken, isPlaidConfigured } from '../../../../lib/budget/plaid';

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  if (!isPlaidConfigured()) {
    return Response.json({ error: 'Plaid is not configured' }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const webhookUrl = origin.startsWith('https://')
    ? `${origin}/api/budget/plaid/webhook`
    : undefined;
  try {
    const { link_token } = await createLinkToken(webhookUrl);
    return Response.json({ linkToken: link_token });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'link token failed' },
      { status: 502 },
    );
  }
}
