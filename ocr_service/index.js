const express = require('express');
const { ocrConsumer } = require('./kafka/consumerOcr');
const { register } = require('./utils/metrics');
const logger = require('./utils/logger');

console.log('Starting OCR Service...');

// Create an Express app for health checks
const app = express();
const PORT = 8080;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'OCR Service',
    timestamp: new Date().toISOString()
  });
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

// Start the server
app.listen(PORT, () => {
  logger.info(`OCR Service health check server running on port ${PORT}`);
});

// Start OCR consumer
ocrConsumer()
  .catch(err => {
    logger.error('Error starting OCR consumer:', err);
    process.exit(1);
  });