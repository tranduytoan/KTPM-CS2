const config = require('../config');

const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

module.exports = kafka;
