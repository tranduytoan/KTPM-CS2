const tesseract = require("node-tesseract-ocr");
const { withRetry } = require("./retry");
const { metrics } = require("./metrics");
const logger = require("./logger");

async function image2text(path){
  const startTime = Date.now();
  try {
    const text = await withRetry(async () => {
      return await tesseract.recognize(path, {
        lang: "eng"
      });
    }, {
      maxRetries: 2,
      baseDelay: 1000,
      shouldRetry: (error) => {
        // Only retry on recognizable errors
        return !error.message.includes("Cannot recognize");
      }
    });
    
    metrics.recordProcessingDuration('ocr', 'success', startTime);
    return text;
  } catch (error) {
    metrics.recordProcessingDuration('ocr', 'failure', startTime);
    logger.error(`OCR error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  image2text
}
