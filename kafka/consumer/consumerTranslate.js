const produceMessage = require('../config/producer');
const { translate } = require('../../utils/translate');
const  { runConsumer } = require('../config/consumer');

const handleMessage = async (message) => {
    try {
        const { text } = JSON.parse(message.value); // Giả sử message là JSON chứa text
        const translatedText = await translate(text); // Dịch text
        await produceMessage('pdf-topic', JSON.stringify({ translatedText }), message.key); // Gửi text sang topic pdf-topic
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

const translateConsumer = async () => {
   await runConsumer('translate-topic', 'translate-group', handleMessage);
}

module.exports = {
    translateConsumer
}