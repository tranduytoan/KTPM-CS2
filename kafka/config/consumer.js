const kafka = require('./kafkaClient');

const runConsumer = async (topic, groupId, handleMessage) => {
  
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: topic, fromBeginning: true });

  // const limit = pLimit(5); // Giới hạn số lượng xử lý đồng thời

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const messageValue = message.value.toString();
      const messageId = message.key ? message.key.toString() : null;

      // console.log(`Received: ${messageValue}`);
      await handleMessage({ value: messageValue, key: messageId });
    },
  });

};

module.exports =  { 
  runConsumer
};
