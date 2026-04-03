/**
 * Cache Service for AI operations
 * Uses in-memory cache with optional Redis support
 */

const logger = require('../../utils/logger');

// In-memory cache as fallback
const memoryCache = new Map();

// Redis client (optional)
let redisClient = null;

// Initialize Redis if available
async function initRedis() {
  try {
    if (process.env.REDIS_URL) {
      const redis = require('redis');
      redisClient = redis.createClient({
        url: process.env.REDIS_URL
      });
      
      redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        redisClient = null;
      });
      
      await redisClient.connect();
      logger.info('Redis connected for AI caching');
    }
  } catch (error) {
    logger.warn('Redis not available, using in-memory cache:', error.message);
    redisClient = null;
  }
}

// Initialize on module load
initRedis().catch(() => {});

/**
 * Get cached value
 */
async function getCache(key) {
  try {
    if (redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      const cached = memoryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
      if (cached) {
        memoryCache.delete(key);
      }
      return null;
    }
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set cached value
 */
async function setCache(key, value, ttlSeconds = 3600) {
  try {
    if (redisClient) {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } else {
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000)
      });
      return true;
    }
  } catch (error) {
    logger.error('Cache set error:', error);
    return false;
  }
}

/**
 * Delete cached value
 */
async function deleteCache(key) {
  try {
    if (redisClient) {
      await redisClient.del(key);
      return true;
    } else {
      memoryCache.delete(key);
      return true;
    }
  } catch (error) {
    logger.error('Cache delete error:', error);
    return false;
  }
}

/**
 * Invalidate all caches for a request
 */
async function invalidateRequestCache(requestType, requestId) {
  const patterns = [
    `ai:analysis:request:${requestType}:${requestId}`,
    `ai:matches:request:${requestType}:${requestId}`,
    `ai:insights:${requestType}:${requestId}`
  ];

  for (const pattern of patterns) {
    await deleteCache(pattern);
  }
}

/**
 * Invalidate talent-related caches
 */
async function invalidateTalentCache(talentId) {
  const patterns = [
    `ai:cv:analysis:${talentId}`,
    `ai:matches:*:${talentId}`
  ];

  // For memory cache, we need to check all keys
  if (!redisClient) {
    for (const key of memoryCache.keys()) {
      if (key.includes(`:${talentId}`) || key.includes(`cv:analysis:${talentId}`)) {
        memoryCache.delete(key);
      }
    }
  } else {
    // For Redis, we'd need SCAN which is more complex
    // For now, just delete known patterns
    for (const pattern of patterns) {
      await deleteCache(pattern);
    }
  }
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  invalidateRequestCache,
  invalidateTalentCache
};

