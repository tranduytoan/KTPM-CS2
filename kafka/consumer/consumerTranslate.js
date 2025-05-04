const produceMessage = require('../config/producer');
const { translate } = require('../../utils/translate');
const { runConsumer } = require('../config/consumer');
const config = require('../../config');
const cacheService = require('../../services/cacheService');
const { getImageBufferFromPath } = require('../../utils/imageUtils');
const logger = require('../../utils/logger');

const handleMessage = async (message) => {
    try {
        const startTime = Date.now();
        logger.info(`Translation processing started for message: ${message.key}`);
        
        const { text, imagePath } = JSON.parse(message.value); // Parse message with text and image path
        
        // Thực hiện dịch text, không cần kiểm tra cache vì đã kiểm tra ở app.js
        logger.info(`Performing translation for message: ${message.key}`);
        const translatedText = await translate(text); // Dịch text
        
        // Cache kết quả dịch
        const imageBuffer = await getImageBufferFromPath(imagePath);
        await cacheService.cacheResult(imageBuffer, translatedText, 'translatedText');
        
        // Chuyển kết quả dịch đến bộ tạo PDF
        await produceMessage(config.topics.pdf, JSON.stringify({translatedText, imagePath}), message.key);

        const endTime = Date.now();
        const processingTime = endTime - startTime;
        logger.info(`Translation completed for message: ${message.key} - Processing time: ${processingTime}ms`);
    } catch (error) {
        logger.error('Error processing translation message:', error);
    }
}

const translateConsumer = async () => {
   await runConsumer(config.topics.translate, config.consumerGroups.translate, handleMessage);
}

module.exports = {
    translateConsumer
}