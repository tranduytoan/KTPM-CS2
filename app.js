const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ocr = require('./utils/ocr');
const { translate } = require('./utils/translate');
const { createPDF } = require('./utils/pdf');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cấu hình upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Đảm bảo thư mục uploads tồn tại
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
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
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng upload một file hình ảnh' });
    }

    const imagePath = req.file.path;
    
    // Xử lý OCR: chuyển ảnh sang text
    const text = await ocr.image2text(imagePath);
    
    // Dịch text từ tiếng Anh sang tiếng Việt
    const viText = await translate(text);
    
    // Tạo file PDF từ text tiếng Việt
    const pdfPath = createPDF(viText);
    
    // Trả về file PDF
    res.download(pdfPath, 'translated_document.pdf', (err) => {
      if (err) {
        console.error('Lỗi khi tải file PDF:', err);
        res.status(500).send('Lỗi khi tải file PDF');
      }
      
      // Xóa file ảnh sau khi xử lý xong
      fs.unlink(imagePath, (err) => {
        if (err) console.error('Không thể xóa file ảnh tạm:', err);
      });
    });
  } catch (error) {
    console.error('Lỗi xử lý:', error);
    res.status(500).json({ error: 'Lỗi khi xử lý file ảnh' });
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
