const redis = require('redis');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('../config');
const { metrics } = require('../utils/metrics');

// Create Redis client with configuration (reuse existing Redis connection)
const client = redis.createClient({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis server refused connection');
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Promisify Redis commands
const zaddAsync = promisify(client.zadd).bind(client);
const zrangebyscoreAsync = promisify(client.zrangebyscore).bind(client);
const zremrangebyscoreAsync = promisify(client.zremrangebyscore).bind(client);
const zremrangebyrankAsync = promisify(client.zremrangebyrank).bind(client);
const expireAsync = promisify(client.expire).bind(client);
const ttlAsync = promisify(client.ttl).bind(client);

/**
 * Check if a request should be rate limited using sliding window approach
 * @param {string} identifier - Unique identifier for the client (IP address, API key, etc.)
 * @param {number} limit - Maximum number of requests allowed
 * @param {number} windowSec - Time window in seconds
 * @returns {Promise<Object>} - Rate limit information
 */
const checkRateLimit = async (identifier, limit = 5, windowSec = 60) => {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - (windowSec * 1000);

  try {
    // Add current timestamp to the sorted set
    await zaddAsync(key, now, now.toString());
    
    // Set expiration on the key to ensure cleanup
    await expireAsync(key, windowSec * 2);
    
    // Remove timestamps outside the current window
    await zremrangebyscoreAsync(key, 0, windowStart);
    
    // Get all timestamps in the current window
    const timestamps = await zrangebyscoreAsync(key, windowStart, '+inf');
    
    // Count requests in the current window
    const current = timestamps.length;
    
    // Calculate remaining requests
    const remaining = Math.max(0, limit - current);
    
    // Get key TTL
    const ttl = await ttlAsync(key);
    
    // Determine if the request should be limited
    const isRateLimited = current > limit;
    
    if (isRateLimited) {
      logger.warn(`Rate limit exceeded for ${identifier}: ${current}/${limit} requests`);
      metrics.rateLimit.inc({ identifier });
      
      // If we're over the limit, remove the current request to stay at the limit
      if (current > limit) {
        await zremrangebyrankAsync(key, 0, 0);
      }
    }
    
    return {
      isRateLimited,
      limit,
      remaining,
      reset: Math.ceil(windowSec - ((now - parseInt(timestamps[0] || now)) / 1000)),
      current
    };
  } catch (error) {
    logger.error(`Rate limiting error: ${error.message}`);
    // In case of error, allow the request to proceed
    return {
      isRateLimited: false,
      limit,
      remaining: limit - 1,
      reset: windowSec,
      current: 1
    };
  }
};

module.exports = {
  checkRateLimit
};
