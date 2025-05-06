const logger = require('./logger');

/**
 * Executes a function with retry logic
 * @param {Function} fn - The function to execute (must return a promise)
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay between retries in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay between retries in ms (default: 5000)
 * @param {Function} options.shouldRetry - Function to determine if retry should occur (default: retry on any error)
 * @returns {Promise} - Result of the function execution
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 5000,
    shouldRetry = () => true,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        logger.error(`Operation failed after ${attempt} attempts: ${error.message}`);
        throw error;
      }

      // Calculate exponential backoff with jitter
      const delay = Math.min(
        maxDelay,
        baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
      );

      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  withRetry
};
