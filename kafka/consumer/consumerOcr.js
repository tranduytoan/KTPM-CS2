const produceMessage = require('../config/producer');
const { image2text } = require('../../utils/ocr');
const { runConsumer } = require('../config/consumer');
const config = require('../../config');
const logger = require('../../utils/logger');

const handleMessage = async ({value, key}) => {
    try {
        const startTime = Date.now();
        logger.info(`OCR processing started for message: ${key}`);
        
        const imagePath = value.toString(); // Đường dẫn đến file hình ảnh
        
        // Process image with OCR
        logger.info(`Performing OCR for message: ${key}`);
        const text = await image2text(imagePath); // Chuyển ảnh sang text
        
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
    await runConsumer(config.topics.ocr, config.consumerGroups.ocr, handleMessage);
}    

module.exports = { ocrConsumer };
