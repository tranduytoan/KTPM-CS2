const kafka = require("./kafka/kafkaClient");

// Configuration for Pipe and Filter Pattern
module.exports = {
  parallelism: {
    ocr: 4,         // Number of parallel OCR processors
    translate: 2,    // Number of parallel translate processors
    pdf: 1          // Number of parallel PDF generators
  },

  // Kafka topics configuration
  topics: {
    ocr: 'ocr-topic',
    translate: 'translate-topic',
    pdf: 'pdf-topic'
  },
  
  // Consumer group IDs
  consumerGroups: {
    ocr: 'ocr-group',
    translate: 'translate-group',
    pdf: 'pdf-group'
  },

  redis: {
    host: 'localhost',
    port: 6379,
    password: '',
    // Cache configuration
    cacheExpiry: 86400, // 24 hours in seconds
    maxMemory: '256mb',
    evictionPolicy: 'allkeys-lru',
    // Key prefixes for organized caching
    keyPrefix: {
      imageHash: 'img:',
      pdfPath: 'pdf:',
      translatedText: 'trans:'
    }
  },

  kafka: {
    clientId: 'pipe-filter-app',
    brokers: ['localhost:9092'],
  },
};
