export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import redis from '@/app/lib/redis';

// Throwaway diagnostic: reports Redis memory/keyspace health so we can judge stability + headroom.
// GET /api/admin/redis-health

function parseInfo(info: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of info.split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf(':');
    if (idx === -1) continue;
    out[l.slice(0, idx)] = l.slice(idx + 1);
  }
  return out;
}

// Bucket a key into a coarse group by its logical prefix (strips the volatile id/name tail).
function bucketOf(key: string): string {
  if (key.startsWith('player-bio:')) return 'player-bio';
  if (/^player-stats:.*:season:/.test(key)) return 'player-stats:season';
  if (/^player-stats:.*:tourn:/.test(key)) return 'player-stats:tourn';
  if (key.startsWith('tourn-stat-lb:')) return 'tourn-stat-lb';
  if (key.startsWith('stat-lb:')) return 'stat-lb';
  if (key.startsWith('field-averages:')) return 'field-averages';
  if (key.startsWith('player-career:')) return 'player-career';
  if (key.startsWith('player-season:')) return 'player-season';
  if (key.startsWith('scorecard')) return 'scorecard';
  if (key.startsWith('leaderboard')) return 'leaderboard';
  if (key.startsWith('tour-averages')) return 'tour-averages';
  // Fall back to the segment before the first ':' so nothing hides.
  const i = key.indexOf(':');
  return i === -1 ? key : key.slice(0, i);
}

export async function GET() {
  try {
    const [memRaw, statsRaw, clientsRaw, serverRaw, keyspaceRaw, dbsize] = await Promise.all([
      redis.info('memory'),
      redis.info('stats'),
      redis.info('clients'),
      redis.info('server'),
      redis.info('keyspace'),
      redis.dbsize(),
    ]);

    const mem = parseInfo(memRaw);
    const stats = parseInfo(statsRaw);
    const clients = parseInfo(clientsRaw);
    const server = parseInfo(serverRaw);
    const keyspace = parseInfo(keyspaceRaw);

    // Walk the whole keyspace with SCAN (non-blocking) to bucket keys and TTL health.
    const buckets: Record<string, { count: number; noExpiry: number; sampleTtls: number[] }> = {};
    let persistent = 0; // keys with no TTL (-1) — the unbounded-growth risk
    let scanned = 0;
    let cursor = '0';
    let iterations = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'COUNT', 500);
      cursor = next;
      iterations++;
      if (keys.length) {
        // Pipeline TTLs for this batch
        const pipe = redis.pipeline();
        for (const k of keys) pipe.ttl(k);
        const ttls = await pipe.exec();
        for (let i = 0; i < keys.length; i++) {
          scanned++;
          const b = bucketOf(keys[i]);
          if (!buckets[b]) buckets[b] = { count: 0, noExpiry: 0, sampleTtls: [] };
          buckets[b].count++;
          const ttl = (ttls?.[i]?.[1] as number) ?? -2;
          if (ttl === -1) { buckets[b].noExpiry++; persistent++; }
          if (buckets[b].sampleTtls.length < 3 && ttl >= 0) buckets[b].sampleTtls.push(ttl);
        }
      }
    } while (cursor !== '0' && iterations < 200);

    const usedBytes = parseInt(mem['used_memory'] ?? '0', 10);
    const maxBytes = parseInt(mem['maxmemory'] ?? '0', 10);
    const pctUsed = maxBytes > 0 ? +(usedBytes / maxBytes * 100).toFixed(1) : null;

    const hits = parseInt(stats['keyspace_hits'] ?? '0', 10);
    const misses = parseInt(stats['keyspace_misses'] ?? '0', 10);
    const hitRate = hits + misses > 0 ? +(hits / (hits + misses) * 100).toFixed(1) : null;

    return Response.json({
      server: {
        version: server['redis_version'],
        uptimeDays: server['uptime_in_days'],
      },
      memory: {
        used: mem['used_memory_human'],
        peak: mem['used_memory_peak_human'],
        maxmemory: maxBytes > 0 ? mem['maxmemory_human'] : '(no limit set / provider-managed)',
        pctOfMaxUsed: pctUsed,
        maxmemoryPolicy: mem['maxmemory_policy'],
        fragmentationRatio: mem['mem_fragmentation_ratio'],
      },
      keyspace: {
        totalKeys: dbsize,
        scannedKeys: scanned,
        keysWithNoExpiry: persistent,
        db0: keyspace['db0'] ?? null,
      },
      throughput: {
        totalCommandsProcessed: stats['total_commands_processed'],
        opsPerSec: stats['instantaneous_ops_per_sec'],
        keyspaceHitRatePct: hitRate,
        evictedKeys: stats['evicted_keys'],
        expiredKeys: stats['expired_keys'],
        rejectedConnections: stats['rejected_connections'],
      },
      clients: {
        connected: clients['connected_clients'],
        blocked: clients['blocked_clients'],
        maxClients: clients['maxclients'],
      },
      buckets,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
