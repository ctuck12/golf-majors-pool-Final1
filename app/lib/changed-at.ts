import redis from '@/app/lib/redis';

// Returns when the value behind `key` last CHANGED, not when it was last fetched. Compares the
// current signature to a persisted one and only advances the timestamp when it differs. The
// signature/timestamp are stored with a long TTL so the "changed" time survives normal refetch
// cycles (which happen far more often than the underlying data actually changes).
export async function resolveChangedAt(
  key: string,
  sig: string,
  ttlSeconds: number = 60 * 24 * 60 * 60, // 60 days
): Promise<string> {
  try {
    const raw = await redis.get(key);
    if (raw) {
      const prev = JSON.parse(raw as string) as { sig?: string; changedAt?: string };
      if (prev.sig === sig && prev.changedAt) return prev.changedAt;
    }
  } catch { /* ignore */ }
  const changedAt = new Date().toISOString();
  try { await redis.setex(key, ttlSeconds, JSON.stringify({ sig, changedAt })); } catch { /* ignore */ }
  return changedAt;
}
