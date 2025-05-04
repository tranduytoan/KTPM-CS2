// Configuration for Pipe and Filter Pattern
module.exports = {
  // Number of parallel instances for each filter
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
  }
};
