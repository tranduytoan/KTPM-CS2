const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'], // hoặc địa chỉ Kafka server
});

module.exports = kafka;
