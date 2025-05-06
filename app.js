const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const produceMessage = require('./kafka/config/producer');
const { resultEmitter } = require('./kafka/config/resultEmitter')
const { v4: uuidv4 } = require('uuid');
const { pdfConsumer } = require('./kafka/consumer/consumerPdf');
const { translateConsumer } = require('./kafka/consumer/consumerTranslate');
const config = require('./config');
const cacheService = require('./services/cacheService');
const { getImageBufferFromPath } = require('./utils/imageUtils');
const logger = require('./utils/logger');
const rateLimitMiddleware = require('./middlewares/rateLimitMiddleware');
const healthRoutes = require('./middlewares/healthMiddleware');
const { httpRequestDurationMiddleware, metrics } = require('./utils/metrics');
const { createJob, getJob, updateJob, JOB_STATUS } = require('./services/jobTrackingService');

// Start consumers
translateConsumer();
pdfConsumer();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Add metrics middleware
app.use(httpRequestDurationMiddleware);

// Add rate limiting middleware
app.use('/upload', rateLimitMiddleware({ 
  limit: 5, 
  windowSec: 60
}));

// Register health check endpoints
healthRoutes(app);

// Cấu hình upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Đảm bảo thư mục uploads tồn tại
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uid = uuidv4();
    const fileExt = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uid}${fileExt}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Chỉ chấp nhận file hình ảnh
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|bmp|tiff)$/)) {
      return cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
    }
    cb(null, true);
  }
});

// Endpoint để hiển thị form upload
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint để xử lý upload file
app.post('/upload', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload một file hình ảnh' });
    }
    
    const imagePath = req.file.path;
    const imageBuffer = await getImageBufferFromPath(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const correlationId = uuidv4();
    
    // Check if PDF already exists in cache
    const cachedPdfPath = await cacheService.getCachedResult(imageBuffer, 'pdf');
    
    if (cachedPdfPath && fs.existsSync(cachedPdfPath)) {
      logger.info('Using cached PDF result');
      metrics.cacheHits.inc({ type: 'pdf' });
      metrics.recordProcessingDuration('request_total', 'cache_hit', startTime);
      
      // If PDF is in cache, send directly without Kafka processing
      return res.download(cachedPdfPath, 'translated_document.pdf', (err) => {
        if (err) {
          logger.error('Lỗi khi tải file PDF từ cache:', err);
          res.status(500).send('Lỗi khi tải file PDF');
        }
        // Keep the cached PDF but remove the uploaded image
        fs.unlink(imagePath, (err) => {
          if (err) logger.error('Không thể xóa file ảnh tạm:', err);
        });
      });
    } else if (cachedPdfPath && !fs.existsSync(cachedPdfPath)) {
      logger.info('Cached PDF path exists but file not found, reprocessing...');
      metrics.cacheMisses.inc({ type: 'pdf' });
      await cacheService.removeFromCache(imageBuffer, 'pdf');
    }
    
    // Create a job and track it
    const job = createJob(correlationId, { 
      fileName: req.file.originalname,
      imagePath: imagePath
    });
    
    // Check if we have OCR translated text in cache
    const cachedTranslatedText = await cacheService.getCachedResult(imageBuffer, 'translatedText');

    if (cachedTranslatedText) {
      logger.info('Using cached OCR and translation results');
      metrics.cacheHits.inc({ type: 'translatedText' });
      updateJob(correlationId, { status: JOB_STATUS.PROCESSING });
      await produceMessage(config.topics.pdf, JSON.stringify({
        translatedText: cachedTranslatedText,
        imagePath: imagePath
      }), correlationId);
    } else {
      // If not in cache, start from the beginning
      logger.info('No complete cache found, sending to OCR processing');
      metrics.cacheMisses.inc({ type: 'translatedText' });
      
      // Try to get queue position
      let queuePosition = null;
      try {
        // This is a placeholder - you would need to implement a function to get the actual queue position
        // from your Kafka admin client or metrics
        queuePosition = await getKafkaQueuePosition(config.topics.ocr);
        if (queuePosition > 50) {
          updateJob(correlationId, { queuePosition });
        }
      } catch (err) {
        logger.error('Error getting queue position:', err);
      }
      
      updateJob(correlationId, { status: JOB_STATUS.PROCESSING, queuePosition });
      await produceMessage(
        config.topics.ocr, 
        JSON.stringify({
          imageContent: imageBase64,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          imageOriginPath: imagePath
        }), 
        correlationId
      );
    }

    // Listen for processing completion in the background
    resultEmitter.once(`pdfCreated-${correlationId}`, ({ pdfPath, key }) => {
      if (key === correlationId) {
        metrics.recordProcessingDuration('request_total', 'success', startTime);
        updateJob(correlationId, { 
          status: JOB_STATUS.COMPLETED,
          result: { pdfPath } 
        });
      }
    });
    
    // Return accepted response immediately with job ID
    return res.status(202).json({ 
      status: 'accepted',
      message: 'Đã nhận ảnh và đang xử lý. Vui lòng kiểm tra trạng thái sau.',
      jobId: correlationId,
      queuePosition: job.queuePosition
    });
    
  } catch (error) {
    metrics.recordProcessingDuration('request_total', 'error', startTime);
    logger.error('Lỗi xử lý:', error);
    res.status(500).json({ error: 'Lỗi khi xử lý file ảnh' });
  }
});

// New endpoint to check job status
app.get('/job-status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  // If job is complete, provide download URL
  if (job.status === JOB_STATUS.COMPLETED && job.result && job.result.pdfPath) {
    return res.json({
      status: job.status,
      downloadUrl: `/download/${jobId}`,
      message: 'Xử lý hoàn tất. Nhấn vào nút tải xuống để lấy tài liệu của bạn.'
    });
  }
  
  // If job is still in progress
  if (job.status === JOB_STATUS.QUEUED || job.status === JOB_STATUS.PROCESSING) {
    let message = 'Đang xử lý yêu cầu của bạn. Vui lòng đợi.';
    
    if (job.queuePosition && job.queuePosition > 50) {
      message = `Đang xử lý yêu cầu của bạn. Hiện có ${job.queuePosition} yêu cầu trong hàng đợi. Vui lòng đợi.`;
    }
    
    return res.json({
      status: job.status,
      queuePosition: job.queuePosition,
      message
    });
  }
  
  // If job failed
  if (job.status === JOB_STATUS.FAILED) {
    return res.json({
      status: job.status,
      message: 'Xử lý thất bại. Vui lòng thử lại.',
      error: job.error
    });
  }
  
  // Default response
  return res.json(job);
});

// New endpoint to download completed jobs
app.get('/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.status !== JOB_STATUS.COMPLETED || !job.result || !job.result.pdfPath) {
    return res.status(400).json({ 
      error: 'Document not ready',
      message: 'Tài liệu chưa được xử lý xong hoặc đã hết hạn.' 
    });
  }
  
  const pdfPath = job.result.pdfPath;
  
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ 
      error: 'File not found',
      message: 'Không tìm thấy tài liệu. Có thể đã hết hạn.' 
    });
  }
  
  res.download(pdfPath, 'translated_document.pdf', (err) => {
    if (err) {
      logger.error('Lỗi khi tải file PDF:', err);
      res.status(500).send('Lỗi khi tải file PDF');
    }
    
    // Cleanup logic for the original image if it exists
    if (job.imagePath && fs.existsSync(job.imagePath)) {
      fs.unlink(job.imagePath, (err) => {
        if (err) logger.error('Không thể xóa file ảnh tạm:', err);
      });
    }
  });
});

// Placeholder function for getting Kafka queue position - implementation will depend on your setup
async function getKafkaQueuePosition(topic) {
  // This is a placeholder implementation
  // In a real scenario, you would use the Kafka Admin API to get lag metrics
  // or implement a custom solution to track queue size
  try {
    // For this example, return a random number between 0 and 100
    // In production, replace with actual logic to query Kafka
    return Math.floor(Math.random() * 100);
  } catch (error) {
    logger.error('Error getting Kafka queue position:', error);
    return null;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  logger.info(`Server đang chạy tại http://localhost:${PORT}`);
});
