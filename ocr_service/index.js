const { ocrConsumer } = require('./kafka/consumerOcr');

console.log('Starting OCR Service...');
ocrConsumer()
  .catch(err => {
    console.error('Error starting OCR consumer:', err);
    process.exit(1);
  });