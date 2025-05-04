const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const produceMessage = require('./kafka/config/producer');
const { resultEmitter } = require('./kafka/config/resultEmitter')
const { v4: uuidv4 } = require('uuid');
const { ocrConsumer } = require('./kafka/consumer/consumerOcr');
const { pdfConsumer } = require('./kafka/consumer/consumerPdf');
const { translateConsumer } = require('./kafka/consumer/consumerTranslate');
const config = require('./config');
const cacheService = require('./services/cacheService');
const { getImageBufferFromPath } = require('./utils/imageUtils');
const logger = require('./utils/logger');

// Initialize all consumers based on configuration
console.log('Starting pipe and filter system with configuration:');
console.log(`OCR filter: ${config.parallelism.ocr} consumers (fixed 8 partitions)`);
console.log(`Translate filter: ${config.parallelism.translate} consumers (fixed 4 partitions)`);
console.log(`PDF filter: ${config.parallelism.pdf} consumers (fixed 2 partitions)`);

// Start consumers
ocrConsumer();
translateConsumer();
pdfConsumer();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// Admin endpoint to view filter configuration
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API endpoint to get filter configuration
app.get('/api/config', (req, res) => {
  res.json(config.parallelism);
});

// API endpoint để xử lý upload file
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload một file hình ảnh' });
    }
    
    const imagePath = req.file.path;
    const correlationId = uuidv4();
    
    // Get image buffer for caching
    const imageBuffer = await getImageBufferFromPath(imagePath);
    
    // Check if PDF already exists in cache
    const cachedPdfPath = await cacheService.getCachedResult(imageBuffer, 'pdf');
    
    if (cachedPdfPath && fs.existsSync(cachedPdfPath)) {
      logger.info('Using cached PDF result');
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
    }
    
    // Check if we have OCR text and translated text in cache
    const cachedText = await cacheService.getCachedResult(imageBuffer, 'text');
    const cachedTranslatedText = await cacheService.getCachedResult(imageBuffer, 'translatedText');
    
    if (cachedText && cachedTranslatedText) {
      logger.info('Using cached OCR and translation results');
      // Skip OCR and translation, send directly to PDF generation
      await produceMessage(config.topics.pdf, JSON.stringify({ 
        text: cachedText, 
        translatedText: cachedTranslatedText, 
        imagePath 
      }), correlationId);
    } else {
      // If not in cache, start from the beginning
      logger.info('No complete cache found, sending to OCR processing');
      await produceMessage(config.topics.ocr, imagePath, correlationId);
    }

    const TIMEOUT = 15000; // 15 seconds

    const timeout = setTimeout(() => {
      resultEmitter.removeAllListeners(`pdfCreated-${correlationId}`); // tránh leak memory
      res.status(504).json({ error: 'Xử lý ảnh mất quá nhiều thời gian' });
    }, TIMEOUT);

    resultEmitter.once(`pdfCreated-${correlationId}`, ({ pdfPath, key }) => {
      if (key === correlationId) {
        clearTimeout(timeout);
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
    logger.error('Lỗi xử lý:', error);
    res.status(500).json({ error: 'Lỗi khi xử lý file ảnh' });
  }
});

app.listen(PORT, () => {
  logger.info(`Server đang chạy tại http://localhost:${PORT}`);
});
