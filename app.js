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
    
    // Check if we have OCR translated text in cache
    const cachedTranslatedText = await cacheService.getCachedResult(imageBuffer, 'translatedText');

    if (cachedTranslatedText) {
      logger.info('Using cached OCR and translation results');
      metrics.cacheHits.inc({ type: 'translatedText' });
      await produceMessage(config.topics.pdf, JSON.stringify({
        translatedText: cachedTranslatedText,
        imagePath: imagePath
      }), correlationId);
    } else {
      // If not in cache, start from the beginning
      logger.info('No complete cache found, sending to OCR processing');
      metrics.cacheMisses.inc({ type: 'translatedText' });
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

    const TIMEOUT = 15000; // 15 seconds

    const timeout = setTimeout(() => {
      resultEmitter.removeAllListeners(`pdfCreated-${correlationId}`); // tránh leak memory
      metrics.recordProcessingDuration('request_total', 'timeout', startTime);
      res.status(504).json({ error: 'Xử lý ảnh mất quá nhiều thời gian' });
    }, TIMEOUT);

    resultEmitter.once(`pdfCreated-${correlationId}`, ({ pdfPath, key }) => {
      if (key === correlationId) {
        clearTimeout(timeout);
        metrics.recordProcessingDuration('request_total', 'success', startTime);
        
        res.download(pdfPath, 'translated_document.pdf', (err) => {
          if (err) {
            logger.error('Lỗi khi tải file PDF:', err);
            res.status(500).send('Lỗi khi tải file PDF');
          }

          // Xóa file ảnh sau khi xử lý xong
          fs.unlink(imagePath, (err) => {
            if (err) logger.error('Không thể xóa file ảnh tạm:', err);
          });

          // Don't delete the PDF if we just cached it
          // The cleanup can be handled by a separate process or TTL
        });
      }
    });
  } catch (error) {
    metrics.recordProcessingDuration('request_total', 'error', startTime);
    logger.error('Lỗi xử lý:', error);
    res.status(500).json({ error: 'Lỗi khi xử lý file ảnh' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  logger.info(`Server đang chạy tại http://localhost:${PORT}`);
});
