const kafka = require('./kafkaClient');

const producer = kafka.producer();

const produceMessage = async (topic, message, id) => {
  await producer.connect();
  await producer.send({
    topic,
    messages: [{ value: message, key: id }],
  });
  await producer.disconnect();
};

module.exports = produceMessage;
