// const produceMessage = require('../config/producer');
const { createPDF } = require('../../utils/pdf');
const  { runConsumer } = require('../config/consumer');
const { resultEmitter }= require('../config/resultEmitter');

const handleMessage = async ({ value, key }) => {
    try {
        console.log('Received message: ', key);
        const { translatedText } = JSON.parse(value); // Gi ả sử message là JSON chứa translatedText
        const pdfPath = await createPDF(translatedText, key); // Tạo PDF từ text đã dịch
        // console.log('PDF created at:', pdfPath);
        resultEmitter.emit('pdfCreated', { pdfPath, key }); // Phát sự kiện khi PDF đã được tạo

    } catch (error) {
        console.error('Error processing message:', error);
    }
}

const pdfConsumer = async () => {
    await runConsumer('pdf-topic', 'pdf-group', handleMessage);
}
module.exports =  { 
    pdfConsumer
}