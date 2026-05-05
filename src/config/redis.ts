import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// BullMQ requires maxRetriesPerRequest to be null
export const redisConnection = new Redis(process.env.REDIS_URI || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
