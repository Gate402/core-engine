import Redis from 'ioredis';
import { env } from './env';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export default redis;
