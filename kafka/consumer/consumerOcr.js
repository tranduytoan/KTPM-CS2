
const produceMessage = require('../config/producer');
const { image2text } = require('../../utils/ocr');
const { runConsumer } = require('../config/consumer');
const config = require('../../config');

const handleMessage = async ({value, key}) => {
    try {
        console.log(`OCR processing started for message: ${key}`);
        const imagePath = value.toString(); // Đường dẫn đến file hình ảnh
        const text = await image2text(imagePath); // Chuyển ảnh sang text
        await produceMessage(config.topics.translate, JSON.stringify({ text, imagePath }), key); // Gửi text sang topic translate-topic
        console.log(`OCR completed for message: ${key}`);
    } catch (error) {
        console.error('Error processing OCR message:', error);
    }
}

const ocrConsumer = async () => {
    await runConsumer(config.topics.ocr, config.consumerGroups.ocr, handleMessage);
}    

module.exports = { ocrConsumer };
