const redis = require('redis');
const { promisify } = require('util');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// Create Redis client with configuration
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
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);
const existsAsync = promisify(client.exists).bind(client);

client.on('error', (err) => {
  logger.error(`Redis Error: ${err}`);
});

client.on('connect', () => {
  logger.info('Connected to Redis server');
});

/**
 * Generate a hash for an image buffer
 * @param {Buffer} imageBuffer - Image buffer to hash
 * @returns {string} - Generated hash
 */
const generateImageHash = (imageBuffer) => {
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
};

/**
 * Cache the result associated with an image
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} result - Result to cache (PDF path or extracted text)
 * @param {string} type - Type of result ('pdf' or 'translatedText')
 * @returns {Promise<boolean>} - Success status
 */
const cacheResult = async (imageBuffer, result, type = 'pdf') => {
  try {
    const imageHash = generateImageHash(imageBuffer);
    let prefix;
    
    if (type === 'pdf') {
      prefix = config.redis.keyPrefix.pdfPath;
    } else if (type === 'translatedText') {
      prefix = config.redis.keyPrefix.translatedText;
    } else {
      // Default to pdf prefix
      prefix = config.redis.keyPrefix.pdfPath;
    }
    
    const key = `${prefix}${imageHash}`;
    
    await setAsync(key, result, 'EX', config.redis.cacheExpiry);
    logger.info(`Cached ${type} result for image: ${imageHash}`);
    return true;
  } catch (error) {
    logger.error(`Error caching result: ${error.message}`);
    return false;
  }
};

/**
 * Get cached result for an image
 * @param {Buffer} imageBuffer - Image buffer to look up
 * @param {string} type - Type of result to retrieve ('pdf' or 'translatedText')
 * @returns {Promise<string|null>} - Cached result or null if not found
 */
const getCachedResult = async (imageBuffer, type = 'pdf') => {
  try {
    const imageHash = generateImageHash(imageBuffer);
    let prefix;
    
    if (type === 'pdf') {
      prefix = config.redis.keyPrefix.pdfPath;
    } else if (type === 'translatedText') {
      prefix = config.redis.keyPrefix.translatedText;
    } else {
      // Default to pdf prefix
      prefix = config.redis.keyPrefix.pdfPath;
    }
    
    const key = `${prefix}${imageHash}`;
    
    const result = await getAsync(key);
    if (result) {
      logger.info(`Cache hit for ${type}: ${imageHash}`);
    } else {
      logger.info(`Cache miss for ${type}: ${imageHash}`);
    }
    return result;
  } catch (error) {
    logger.error(`Error getting cached result: ${error.message}`);
    return null;
  }
};

/**
 * Check if a result exists in cache
 * @param {Buffer} imageBuffer - Image buffer to check
 * @param {string} type - Type of result to check ('pdf' or 'translatedText')
 * @returns {Promise<boolean>} - True if exists in cache
 */
const existsInCache = async (imageBuffer, type = 'pdf') => {
  try {
    const imageHash = generateImageHash(imageBuffer);
    const prefix = type === 'pdf' ? config.redis.keyPrefix.pdfPath : config.redis.keyPrefix.translatedText;
    const key = `${prefix}${imageHash}`;
    
    const exists = await existsAsync(key);
    return exists === 1;
  } catch (error) {
    logger.error(`Error checking cache: ${error.message}`);
    return false;
  }
};

/**
 * Remove an item from cache
 * @param {Buffer} imageBuffer - Image buffer to remove
 * @param {string} type - Type of result to remove ('pdf' or 'translatedText')
 * @returns {Promise<boolean>} - Success status
 */
const removeFromCache = async (imageBuffer, type = 'pdf') => {
  try {
    const imageHash = generateImageHash(imageBuffer);
    const prefix = type === 'pdf' ? config.redis.keyPrefix.pdfPath : config.redis.keyPrefix.translatedText;
    const key = `${prefix}${imageHash}`;
    
    await delAsync(key);
    logger.info(`Removed ${type} from cache: ${imageHash}`);
    return true;
  } catch (error) {
    logger.error(`Error removing from cache: ${error.message}`);
    return false;
  }
};

/**
 * Close Redis connection
 */
const closeConnection = () => {
  client.quit();
};

module.exports = {
  generateImageHash,
  cacheResult,
  getCachedResult,
  existsInCache,
  removeFromCache,
  closeConnection
};
