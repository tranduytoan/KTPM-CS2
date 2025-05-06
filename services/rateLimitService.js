const redis = require('redis');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('../config');

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
const incrAsync = promisify(client.incr).bind(client);
const expireAsync = promisify(client.expire).bind(client);
const ttlAsync = promisify(client.ttl).bind(client);

/**
 * Check if a request should be rate limited
 * @param {string} identifier - Unique identifier for the client (IP address, API key, etc.)
 * @param {number} limit - Maximum number of requests allowed
 * @param {number} windowSec - Time window in seconds
 * @returns {Promise<Object>} - Rate limit information
 */
const checkRateLimit = async (identifier, limit = 5, windowSec = 60) => {
  const key = `ratelimit:${identifier}`;

  try {
    // Increment the counter
    const current = await incrAsync(key);
    
    // Set the expiry if this is the first request in the window
    if (current === 1) {
      await expireAsync(key, windowSec);
    }
    
    // Get remaining TTL
    const ttl = await ttlAsync(key);
    
    // Calculate remaining requests
    const remaining = Math.max(0, limit - current);
    
    // Determine if the request should be limited
    const isRateLimited = current > limit;
    
    if (isRateLimited) {
      logger.warn(`Rate limit exceeded for ${identifier}: ${current}/${limit} requests`);
    }
    
    return {
      isRateLimited,
      limit,
      remaining,
      reset: ttl,
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
