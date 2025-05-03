
const produceMessage = require('../config/producer');
const { image2text } = require('../../utils/ocr');
const  { runConsumer } = require('../config/consumer');

const handleMessage = async ({value, key}) => {
    try {
        const imagePath = value.toString(); // Đường dẫn đến file hình ảnh
        const text = await image2text(imagePath); // Chuyển ảnh sang text
        await produceMessage('translate-topic', JSON.stringify({ text }), key); // Gửi text sang topic translate-topic
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

const ocrConsumer = async () => {
    await runConsumer('ocr-topic', 'ocr-group', handleMessage);
}    

module.exports =  { ocrConsumer };
