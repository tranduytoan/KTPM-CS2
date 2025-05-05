const produceMessage = require('./producer');
const { image2text } = require('../utils/ocr');
const config = require('../config');
const logger = require('../utils/logger');
const kafka = require('./kafkaClient');
const pLimit = require('p-limit');
const fs = require('fs');
const path = require('path');
const os = require('os');

const runConsumer = async (handleMessage) => {
  const concurrencyLimit = config.parallelism.ocr;
  const topic = config.topics.ocr;
  const groupId = config.consumerGroups.ocr;
  
  // Tạo hàm giới hạn đồng thời đúng cách
  const limit = pLimit(concurrencyLimit);
  const maxLimitPendingCount = concurrencyLimit * 5;
  
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: topic, fromBeginning: true });

  console.log(`Started ${topic} consumer with ${concurrencyLimit} parallel processors`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const messageValue = message.value.toString();
      const messageId = message.key ? message.key.toString() : null;

      while (limit.pendingCount >= maxLimitPendingCount) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      limit(() => handleMessage({ value: messageValue, key: messageId }))
      .catch(err => console.error(`Error processing message from ${topic}:`, err));
    },
  });
};

const handleMessage = async ({value, key}) => {
    try {
        const startTime = Date.now();
        logger.info(`OCR processing started for message: ${key}`);
        
        // const imagePath = value.toString(); // Đường dẫn đến file hình ảnh
        const messageData = JSON.parse(value);
        const imagePath = messageData.imageOriginPath;
        const imageBuffer = Buffer.from(messageData.imageContent, 'base64');
        // Lưu tạm file để xử lý OCR
        const tempImagePath = path.join(os.tmpdir(), `${key}.png`);
        await fs.promises.writeFile(tempImagePath, imageBuffer);
        
        // Process image with OCR
        logger.info(`Performing OCR for message: ${key}`);
        const text = await image2text(tempImagePath);

        fs.unlink(tempImagePath, err => {
            if (err) logger.error(`Error removing temp file: ${err.message}`);
        });
        
        // Send to next filter
        await produceMessage(config.topics.translate, JSON.stringify({ text, imagePath }), key);
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        logger.info(`OCR completed for message: ${key} - Processing time: ${processingTime}ms`);
    } catch (error) {
        logger.error('Error processing OCR message:', error);
    }
}

const ocrConsumer = async () => {
    await runConsumer(handleMessage);
}    

module.exports = { ocrConsumer };
