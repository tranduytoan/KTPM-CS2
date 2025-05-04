const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'pipe-filter-app',
  brokers: ['localhost:9092'], // hoặc địa chỉ Kafka server
});

module.exports = kafka;
