const produceMessage = require('../config/producer');
const { translate } = require('../../utils/translate');
const { runConsumer } = require('../config/consumer');
const config = require('../../config');

const handleMessage = async (message) => {
    try {
        console.log(`Translation processing started for message: ${message.key}`);
        const { text, imagePath } = JSON.parse(message.value); // Parse message with text and image path
        const translatedText = await translate(text); // Dịch text
        
        // Forward the translated text to the PDF generator
        await produceMessage(config.topics.pdf, JSON.stringify({ translatedText, imagePath }), message.key);
        console.log(`Translation completed for message: ${message.key}`);
    } catch (error) {
        console.error('Error processing translation message:', error);
    }
}

const translateConsumer = async () => {
   await runConsumer(config.topics.translate, config.consumerGroups.translate, handleMessage);
}

module.exports = {
    translateConsumer
}