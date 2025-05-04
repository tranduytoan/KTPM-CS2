const kafka = require('./kafkaClient');
const config = require('../../config');
const pLimit = require('p-limit');
const e = require('express');

const runConsumer = async (topic, groupId, handleMessage) => {
  // Get the parallelism configuration based on the topic name
  let concurrencyLimit = 1; // Default value
  
  if (topic === config.topics.ocr) {
    concurrencyLimit = config.parallelism.ocr;
  } else if (topic === config.topics.translate) {
    concurrencyLimit = config.parallelism.translate;
  } else if (topic === config.topics.pdf) {
    concurrencyLimit = config.parallelism.pdf;
  }
  
  // Tạo hàm giới hạn đồng thời đúng cách
  const limit = pLimit(concurrencyLimit);
  const maxLimitPendingCount = concurrencyLimit * 5;
  
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: topic, fromBeginning: true });

  console.log(`Started ${topic} consumer with ${concurrencyLimit} parallel processors`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const messageValue = message.value.toString();
      const messageId = message.key ? message.key.toString() : null;

      if (topic !== config.topics.ocr) {
        limit(() => handleMessage({ value: messageValue, key: messageId }))
        .catch(err => console.error(`Error processing message from ${topic}:`, err));
      } else { // first topic
        while (limit.pendingCount >= maxLimitPendingCount) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        limit(() => handleMessage({ value: messageValue, key: messageId }))
        .catch(err => console.error(`Error processing message from ${topic}:`, err));
      }
    },
  });
};

module.exports = { 
  runConsumer
};
