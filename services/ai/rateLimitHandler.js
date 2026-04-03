/**
 * Rate Limit Handler for Gemini API
 * Handles 429 errors with exponential backoff and retry logic
 */

const logger = require('../../utils/logger');

// Track rate limit errors per model
const rateLimitCache = new Map();

/**
 * Check if we're currently rate limited for a model
 */
function isRateLimited(modelName) {
  const cacheKey = `rate_limit:${modelName}`;
  const limitInfo = rateLimitCache.get(cacheKey);
  
  if (!limitInfo) return false;
  
  const now = Date.now();
  const retryAfter = limitInfo.retryAfter * 1000; // Convert to milliseconds
  
  if (now < limitInfo.resetAt) {
    const waitTime = Math.ceil((limitInfo.resetAt - now) / 1000);
    logger.warn(`[Rate Limit] Model ${modelName} is rate limited. Wait ${waitTime}s`);
    return true;
  }
  
  // Rate limit expired, remove from cache
  rateLimitCache.delete(cacheKey);
  return false;
}

/**
 * Record a rate limit error
 */
function recordRateLimit(modelName, retryAfterSeconds) {
  const cacheKey = `rate_limit:${modelName}`;
  const resetAt = Date.now() + (retryAfterSeconds * 1000);
  
  rateLimitCache.set(cacheKey, {
    modelName,
    retryAfter: retryAfterSeconds,
    resetAt,
    recordedAt: Date.now()
  });
  
  logger.warn(`[Rate Limit] Recorded rate limit for ${modelName}. Retry after ${retryAfterSeconds}s`);
}

/**
 * Extract retry delay from error message
 */
function extractRetryDelay(error) {
  try {
    // Try to extract from error message
    const retryMatch = error.message?.match(/retry in ([\d.]+)s/i);
    if (retryMatch) {
      return parseFloat(retryMatch[1]);
    }
    
    // Try to extract from error details
    if (error.error?.details) {
      for (const detail of error.error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo') {
          const delay = detail.retryDelay || detail.retry_delay;
          if (delay) {
            return parseInt(delay.replace('s', '')) || 60;
          }
        }
      }
    }
  } catch (e) {
    logger.debug('Failed to extract retry delay:', e.message);
  }
  
  // Default retry delay
  return 60; // 60 seconds default
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error) {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString();
  return errorMessage.includes('429') || 
         errorMessage.includes('Too Many Requests') ||
         errorMessage.includes('quota') ||
         errorMessage.includes('rate limit');
}

/**
 * Wait for rate limit to expire
 */
async function waitForRateLimit(modelName) {
  const cacheKey = `rate_limit:${modelName}`;
  const limitInfo = rateLimitCache.get(cacheKey);
  
  if (!limitInfo) return;
  
  const waitTime = Math.max(0, limitInfo.resetAt - Date.now());
  if (waitTime > 0) {
    const waitSeconds = Math.ceil(waitTime / 1000);
    logger.info(`[Rate Limit] Waiting ${waitSeconds}s for ${modelName} rate limit to reset`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Clear rate limit cache (useful for testing)
 */
function clearRateLimitCache() {
  rateLimitCache.clear();
}

module.exports = {
  isRateLimited,
  recordRateLimit,
  extractRetryDelay,
  isRateLimitError,
  waitForRateLimit,
  clearRateLimitCache
};

