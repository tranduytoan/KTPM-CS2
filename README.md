# CASE STUDY 2
Dưới đây là một chương trình có nhiệm vụ chuyển file ảnh tiếng Anh sang một file `pdf` tiếng Việt. Các bước xử lý lần lượt bao gồm: chuyển đổi ảnh sang text, dịch tiếng Anh sang tiếng Việt, chuyển đổi nội dung text thành file `pdf`. Chương trình chính chỉ demo các tính năng này tuần tự.

## Hướng dẫn cài đặt
Yêu cầu cài đặt trước [tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html) trên hệ điều hành của bạn. 

```sh
# Cài đặt các gói liên quan
$ npm install
# Tạo folder cho output
$ mkdir output
# Khởi chạy ứng dụng demo
$ npm start
```

## Mô Tả
| File | Chức năng |
|--|:--|
| utils/ocr.js | Chuyển đổi ảnh sang text |
| utils/translate.js | Dịch tiếng Anh sang tiếng Việt |
| utils/pdf.js | Chuyển đổi text sang PDF |


## Yêu cầu triển khai
| Mức độ | Mô tả |
|--|--|
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-easy-green) | Triển khai thành web hoàn chỉnh |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-hard-red) | Sử dụng cache để tăng hiệu suất ứng dụng |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-medium-yellow) | Lựa chọn số lượng filter tối ưu nhất với hạ tầng phần cứng |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-warning-orange)  | Không thay đổi thư viện của từng chức năng |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-easy-green)  | Hoàn thiện chương trình sử dụng `express.js` cho phép upload một file ảnh và tải về một file `pdf` tương ứng |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-medium-yellow) | Sử dụng `message queue` cho chương trình trên (ví dụ: Kafka, RabbitMQ,...) |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-medium-yellow) | *Đánh giá* và *so sánh* hiệu năng dựa trên kiến trúc đã triển khai |

## Hướng dẫn test hiệu năng

# 📦 JMeter Test cho API Upload ảnh (Node.js + Kafka)

Hướng dẫn cài đặt và kiểm thử API `/upload` sử dụng [Apache JMeter](https://jmeter.apache.org/) — dành cho ứng dụng upload ảnh, xử lý qua Kafka và trả về PDF.

---

## ✅ Yêu cầu

* Node.js app chạy tại `http://localhost:3000`
* Đã chạy docker với Kafka và các consumer (`ocrConsumer`, `pdfConsumer`, v.v.)
* Một số ảnh mẫu để test (jpg, png,...)

---

## 🚀 Bước 1: Cài đặt Apache JMeter

### Cách 1: Tải thủ công

1. Tải JMeter: [https://jmeter.apache.org/download\_jmeter.cgi](https://jmeter.apache.org/download_jmeter.cgi)
2. Giải nén và mở thư mục `bin/`
3. Chạy `jmeter.bat` (Windows) hoặc `./jmeter` (Mac/Linux)

## ⚙️ Bước 2: Cấu hình test trong JMeter

### 1. Tạo Test Plan

* Mở JMeter
* Add → **Test Plan**

### 2. Thêm Thread Group

* Add → Threads → **Thread Group**

  * **Number of Threads (users)**: Số lượng người dùng gửi request
  * **Loop Count**: Số lần lặp (1 là đủ để test)

### 3. Thêm HTTP Request

* Add → Sampler → **HTTP Request**

  * **Method**: `POST`
  * **Server Name**: `localhost`
  * **Port**: `3000`
  * **Path**: `/upload`
  * Tick **Use multipart/form-data**
  * Sang tab **Files Upload**:

    * **File Path**: đường dẫn tới ảnh (VD: `C:\test\image.jpg`)
    * **Parameter name**: `image`
    * **MIME Type**: `image/jpeg`

### 4. Thêm Listener (xem kết quả)

* Add → Listener → **View Results Tree** (để debug)
* Add → Listener → **Summary Report** hoặc **Aggregate Report** (để xem tổng quan hiệu năng)

---

## ▶️ Bước 3: Chạy Test

1. Nhấn nút **Start**
2. Quan sát kết quả trả về:

   * File trả về là PDF (nếu thành công)
   * Hoặc lỗi nếu server xử lý chậm hoặc sai

---

## 📌 Ghi chú

* Nếu test hiệu năng lớn, **nên tắt `View Results Tree`** để tránh tốn RAM
* Có thể dùng `CSV Data Set Config` để test nhiều ảnh khác nhau
* Timeout xử lý ảnh trong app là **15 giây**, nên kiểm tra lại tốc độ hệ thống nếu lỗi 504

---

## 📄 Tham khảo

* [JMeter Official Site](https://jmeter.apache.org/)
* Kafka setup example: [https://kafka.apache.org/quickstart](https://kafka.apache.org/quickstart)

