const { createPDF } = require('../../utils/pdf');
const { runConsumer } = require('../config/consumer');
const { resultEmitter } = require('../config/resultEmitter');
const config = require('../../config');
const cacheService = require('../../services/cacheService');
const { getImageBufferFromPath } = require('../../utils/imageUtils');
const logger = require('../../utils/logger');

const handleMessage = async ({value, key}) => {
    try {
        const startTime = Date.now();
        logger.info(`PDF processing started for message: ${key}`);

        const { translatedText, imagePath } = JSON.parse(value); // Parse message with translated text and image path
        const pdfPath = await createPDF(translatedText, key); // Tạo PDF từ text đã dịch
        
        const imageBuffer = await getImageBufferFromPath(imagePath);
        await cacheService.cacheResult(imageBuffer, pdfPath, 'pdf');
        
        // Emit the result that PDF has been created
        resultEmitter.emit(`pdfCreated-${key}`, { pdfPath, key });
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        logger.info(`PDF completed for message: ${key} - Processing time: ${processingTime}ms`);
    } catch (error) {
        logger.error('Error processing PDF message:', error);
    }
}

const pdfConsumer = async () => {
    await runConsumer(config.topics.pdf, config.consumerGroups.pdf, handleMessage);
}

module.exports = { pdfConsumer };