const { createPDF } = require('../../utils/pdf');
const { runConsumer } = require('../config/consumer');
const { resultEmitter } = require('../config/resultEmitter');
const config = require('../../config');
const fs = require('fs');

const handleMessage = async ({ value, key }) => {
    try {
        const startTime = Date.now();
        console.log(`PDF generation started for message: ${key}`);
        
        const { translatedText, imagePath } = JSON.parse(value); // Parse message with translated text and image path
        const pdfPath = await createPDF(translatedText, key); // Tạo PDF từ text đã dịch
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        console.log(`PDF created at: ${pdfPath} for message: ${key} - Processing time: ${processingTime}ms`);
        
        // Emit event for download
        resultEmitter.emit(`pdfCreated-${key}`, { pdfPath, key });
    } catch (error) {
        console.error('Error processing PDF message:', error);
    }
}

const pdfConsumer = async () => {
    await runConsumer(config.topics.pdf, config.consumerGroups.pdf, handleMessage);
}

module.exports = { 
    pdfConsumer
}