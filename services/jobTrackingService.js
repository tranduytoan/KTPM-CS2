const logger = require('../utils/logger');

// In-memory job tracking (could be replaced with Redis or database for production)
const jobs = new Map();

// Job statuses
const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Create a new job in the tracking system
 * @param {string} jobId - Unique job identifier (correlationId)
 * @param {Object} metadata - Additional job information
 * @returns {Object} Job object
 */
const createJob = (jobId, metadata = {}) => {
  const job = {
    id: jobId,
    status: JOB_STATUS.QUEUED,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    result: null,
    error: null,
    queuePosition: null,
    ...metadata
  };
  
  jobs.set(jobId, job);
  logger.info(`Job created: ${jobId}`);
  return job;
};

/**
 * Update job status and details
 * @param {string} jobId - Unique job identifier
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated job or null if not found
 */
const updateJob = (jobId, updates) => {
  if (!jobs.has(jobId)) {
    logger.warn(`Attempted to update non-existent job: ${jobId}`);
    return null;
  }
  
  const job = jobs.get(jobId);
  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: Date.now()
  };
  
  jobs.set(jobId, updatedJob);
  logger.info(`Job updated: ${jobId}, status: ${updatedJob.status}`);
  return updatedJob;
};

/**
 * Get job details by ID
 * @param {string} jobId - Unique job identifier
 * @returns {Object|null} Job object or null if not found
 */
const getJob = (jobId) => {
  return jobs.get(jobId) || null;
};

/**
 * Clean up completed jobs after a period
 * @param {number} maxAgeSecs - Maximum age in seconds before cleanup
 */
const cleanupJobs = (maxAgeSecs = 3600) => {
  const now = Date.now();
  const maxAgeMs = maxAgeSecs * 1000;
  
  for (const [jobId, job] of jobs.entries()) {
    if (
      (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) &&
      now - job.updatedAt > maxAgeMs
    ) {
      jobs.delete(jobId);
      logger.info(`Cleaned up job: ${jobId}`);
    }
  }
};

// Run cleanup every hour
setInterval(() => cleanupJobs(), 3600 * 1000);

module.exports = {
  JOB_STATUS,
  createJob,
  updateJob,
  getJob,
  cleanupJobs
};
