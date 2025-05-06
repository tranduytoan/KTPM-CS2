const os = require('os');
const { register } = require('../utils/metrics');

/**
 * Health check middleware for Express
 */
const healthRoutes = (app) => {
  // Basic health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      host: os.hostname()
    });
  });

  // Liveness probe endpoint
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString()
    });
  });

  // Readiness probe endpoint
  app.get('/health/ready', async (req, res) => {
    // You can add additional checks here (database, Redis, etc.)
    try {
      // Add health status of connected services
      res.status(200).json({
        status: 'READY',
        timestamp: new Date().toISOString(),
        services: {
          redis: 'UP',
          kafka: 'UP'
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'NOT_READY',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).send(error.message);
    }
  });
};

module.exports = healthRoutes;
