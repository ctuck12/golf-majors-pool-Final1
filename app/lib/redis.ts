import Redis from 'ioredis';

// Shared singleton reused across warm serverless invocations.
const redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 3 });

export default redis;
