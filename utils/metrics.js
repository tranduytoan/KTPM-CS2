const client = require('prom-client');
const logger = require('./logger');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label to all metrics
register.setDefaultLabels({
  app: 'ocr-translate-pdf-app'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const processingDuration = new client.Histogram({
  name: 'processing_duration_seconds',
  help: 'Duration of processing operations in seconds',
  labelNames: ['operation', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

const rateLimit = new client.Counter({
  name: 'rate_limit_total',
  help: 'Total number of rate limited requests',
  labelNames: ['identifier']
});

const slidingWindowRateLimit = new client.Gauge({
  name: 'sliding_window_requests',
  help: 'Number of requests in the current sliding window',
  labelNames: ['identifier']
});

const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['type']
});

const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['type']
});

const retryAttempts = new client.Counter({
  name: 'retry_attempts_total',
  help: 'Total number of retry attempts',
  labelNames: ['operation']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(processingDuration);
register.registerMetric(rateLimit);
register.registerMetric(slidingWindowRateLimit);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);
register.registerMetric(retryAttempts);

// HTTP middleware for Express to monitor request duration
const httpRequestDurationMiddleware = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  
  // Add response hook to update metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const route = req.route ? req.route.path : req.path;
    const statusCode = res.statusCode;
    
    end({ method: req.method, route, status_code: statusCode });
    httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });
    
    return originalEnd.apply(this, args);
  };
  
  next();
};

// Record processing duration
const recordProcessingDuration = (operation, status, startTime) => {
  const duration = (Date.now() - startTime) / 1000;
  processingDuration.observe({ operation, status }, duration);
  return duration;
};

module.exports = {
  register,
  httpRequestDurationMiddleware,
  recordProcessingDuration,
  metrics: {
    rateLimit,
    slidingWindowRateLimit,
    cacheHits,
    cacheMisses,
    retryAttempts,
    processingDuration,
    recordProcessingDuration
  }
};
