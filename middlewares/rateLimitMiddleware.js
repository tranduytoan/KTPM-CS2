const { checkRateLimit } = require('../services/rateLimitService');
const { metrics } = require('../utils/metrics');

/**
 * Rate limiting middleware for Express
 * @param {Object} options - Rate limiting options
 * @param {number} options.limit - Maximum number of requests allowed (default: 5)
 * @param {number} options.windowSec - Time window in seconds (default: 60)
 * @param {Function} options.getIdentifier - Function to extract unique identifier from request (default: IP address)
 * @returns {Function} - Express middleware
 */
const rateLimitMiddleware = (options = {}) => {
  const {
    limit = 5,
    windowSec = 60,
    getIdentifier = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
  } = options;

  return async (req, res, next) => {
    const identifier = getIdentifier(req);
    
    const rateLimitInfo = await checkRateLimit(identifier, limit, windowSec);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset);
    
    if (rateLimitInfo.isRateLimited) {
      // Increment rate limit metric
      metrics.rateLimit.inc({ identifier });
      
      // Send rate limit response
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit of ${limit} requests per ${windowSec} seconds exceeded. Please try again in ${rateLimitInfo.reset} seconds.`
      });
    }
    
    next();
  };
};

module.exports = rateLimitMiddleware;
