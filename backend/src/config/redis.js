const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

function getRedisClient() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) {
          logger.error('Redis: too many retries, giving up');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      reconnectOnError(err) {
        logger.warn(`Redis reconnecting after error: ${err.message}`);
        return true;
      },
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));
  }
  return redis;
}

// Redis key helpers
const KEYS = {
  room: (slug) => `room:${slug}`,
  roomUsers: (slug) => `room:${slug}:users`,
  roomCode: (slug) => `room:${slug}:code`,
  userSocket: (userId) => `user:${userId}:socket`,
  socketUser: (socketId) => `socket:${socketId}:user`,
};

module.exports = { getRedisClient, KEYS };
