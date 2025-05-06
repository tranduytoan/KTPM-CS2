// This script initializes Kafka topics with appropriate partitions
const kafka = require('./kafka/config/kafkaClient');
const config = require('./config');

// Số lượng partition cố định cho mỗi topic
const FIXED_PARTITIONS = {
  ocr: 8,
  translate: 1,
  pdf: 1
};

async function initializeTopics() {
  const admin = kafka.admin();
  
  try {
    console.log('Connecting to Kafka...');
    await admin.connect();
    
    // Get existing topics
    const existingTopics = await admin.listTopics();
    console.log('Existing topics:', existingTopics);
    
    // Topics to create
    const topicsToCreate = [];
    const topicsToCheck = [];
    
    // Check OCR topic
    if (!existingTopics.includes(config.topics.ocr)) {
      topicsToCreate.push({
        topic: config.topics.ocr,
        numPartitions: FIXED_PARTITIONS.ocr,
        replicationFactor: 1 // For development, using 1 is fine
      });
    } else {
      topicsToCheck.push(config.topics.ocr);
    }
    
    // Check Translate topic
    if (!existingTopics.includes(config.topics.translate)) {
      topicsToCreate.push({
        topic: config.topics.translate,
        numPartitions: FIXED_PARTITIONS.translate,
        replicationFactor: 1
      });
    } else {
      topicsToCheck.push(config.topics.translate);
    }
    
    // Check PDF topic
    if (!existingTopics.includes(config.topics.pdf)) {
      topicsToCreate.push({
        topic: config.topics.pdf,
        numPartitions: FIXED_PARTITIONS.pdf,
        replicationFactor: 1
      });
    } else {
      topicsToCheck.push(config.topics.pdf);
    }
      // Create topics if needed
    if (topicsToCreate.length > 0) {
      console.log('Creating topics:', topicsToCreate);
      await admin.createTopics({
        validateOnly: false,
        topics: topicsToCreate
      });
      console.log('Topics created successfully');
    } 
    
    // Kiểm tra số lượng partition cho các topic đã tồn tại
    if (topicsToCheck.length > 0) {
      const topicMetadata = await admin.fetchTopicMetadata({ topics: topicsToCheck });
      
      for (const topic of topicMetadata.topics) {
        const topicName = topic.name;
        const currentPartitions = topic.partitions.length;
        let requiredPartitions = 0;
        
        // Xác định số lượng partition cần thiết cho từng topic
        if (topicName === config.topics.ocr) {
          requiredPartitions = FIXED_PARTITIONS.ocr;
        } else if (topicName === config.topics.translate) {
          requiredPartitions = FIXED_PARTITIONS.translate;
        } else if (topicName === config.topics.pdf) {
          requiredPartitions = FIXED_PARTITIONS.pdf;
        }
        
        console.log(`Topic ${topicName}: Current partitions: ${currentPartitions}, Required: ${requiredPartitions}`);
        
        // Nếu số lượng partition hiện tại ít hơn số lượng yêu cầu, tăng partition
        if (currentPartitions < requiredPartitions) {
          try {
            console.log(`Increasing partitions for topic ${topicName} from ${currentPartitions} to ${requiredPartitions}`);
            await admin.createPartitions({
              topicPartitions: [
                { topic: topicName, count: requiredPartitions }
              ]
            });
            console.log(`Successfully increased partitions for topic ${topicName}`);
          } catch (err) {
            console.error(`Error increasing partitions for topic ${topicName}:`, err.message);
          }
        }
      }
    } else {
      console.log('All required topics already exist with correct partition counts');
    }
  } catch (error) {
    console.error('Error initializing Kafka topics:', error);
  } finally {
    await admin.disconnect();
    console.log('Disconnected from Kafka admin');
  }
}

// Run the initialization function
initializeTopics()
  .then(() => {
    console.log('Kafka topic initialization complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to initialize Kafka topics:', err);
    process.exit(1);
  });
