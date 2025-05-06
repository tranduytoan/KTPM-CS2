# CASE STUDY 2: Tối ưu hệ thống OCR, dịch và tạo PDF

## Thành viên nhóm:
1. Trần Duy Toàn - MSSV: 22026547
2. Vũ Đức Thằng - MSSV: 22026545
3. Phạm Đức Toàn - MSSV: 22026511

## Mô tả dự án
Dự án nhằm phát triển và tối ưu hóa một hệ thống có nhiệm vụ chuyển file ảnh tiếng Anh sang một file `pdf` tiếng Việt. Các bước xử lý lần lượt bao gồm:
1. Chuyển đổi ảnh sang text (OCR)
2. Dịch tiếng Anh sang tiếng Việt
3. Chuyển đổi nội dung text thành file `pdf`

## Yêu cầu và giới hạn
| Mức độ | Mô tả |
|--|--|
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-easy-green) | Triển khai thành web hoàn chỉnh |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-hard-red) | Sử dụng cache để tăng hiệu suất ứng dụng |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-medium-yellow) | Lựa chọn số lượng filter tối ưu nhất với hạ tầng phần cứng |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-warning-orange)  | Không thay đổi thư viện của từng chức năng |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-easy-green)  | Hoàn thiện chương trình sử dụng `express.js` cho phép upload một file ảnh và tải về một file `pdf` tương ứng |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-medium-yellow) | Sử dụng `message queue` cho chương trình trên (ví dụ: Kafka, RabbitMQ,...) |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-medium-yellow) | *Đánh giá* và *so sánh* hiệu năng dựa trên kiến trúc đã triển khai |

## Hướng tiếp cận và phát triển


### Phiên bản 1: Triển khai web cơ bản
- Xây dựng ứng dụng Express.js với endpoint `/upload` để nhận và xử lý ảnh
- Sử dụng Node.js event loop mặc định để xử lý đồng thời các request
- **Nhược điểm**: Node.js event loop xử lý request không song song nhưng đồng thời và không quản lý số tiến trình đồng thời, mà mỗi tiến trình đồng thời lại gọi file thực thi tesseract và tạo ra tiến trình OCR mới chạy song song với nhau. Khi số request lớn tại một thời điểm, số tiến trình đồng thời lớn theo và dẫn tới quá tải tài nguyên, bao gồm cpu max throughput và thư viện `open-google-translator` bị lỗi không thể dịch được.

**Kết quả kiểm thử (100 request đồng thời):**
| Chỉ số | Giá trị |
|:-------|------:|
| Tỷ lệ thành công | 66% |
| Tỷ lệ lỗi | 34% |
| Thời gian phản hồi trung bình | 10,363.5 ms |
| Thời gian xử lý tối thiểu | 3,762 ms |
| Thời gian xử lý tối đa | 12,621 ms |
| Phân vị 95 (p95) | 12,213.1 ms |
| Phân vị 99 (p99) | 12,459.8 ms |

### Phiên bản 2: Triển khai Message Queue đơn luồng
- Tích hợp Kafka làm message queue
- Xây dựng luồng xử lý với 3 topic tuần tự nhau, mỗi topic chỉ có 1 consumer đơn luồng xử lý từng message một
- **Ưu điểm**: Hệ thống ổn định hơn, tỷ lệ lỗi giảm xuống 0%, đã có thể triển khai bất đồng bộ: trả về `202 Accepted` cho client ngay sau khi nhận request.
- **Nhược điểm**: Thời gian xử lý tăng đáng kể do xử lý tuần tự

**Kết quả kiểm thử (100 request đồng thời):**
| Chỉ số | Giá trị |
|:-------|------:|
| Tỷ lệ thành công | 100% |
| Tỷ lệ lỗi | 0% |
| Thời gian phản hồi trung bình | 33,793.8 ms |
| Thời gian xử lý tối thiểu | 1,204 ms |
| Thời gian xử lý tối đa | 66,025 ms |
| Phân vị 95 (p95) | 62,964 ms |
| Phân vị 99 (p99) | 65,533.7 ms |

### Phiên bản 3: Áp dụng Pipe and Filter Pattern
- Triển khai Kafka với 3 topic trước đó đã có sẵn base cho Pipe and Filter Pattern
- Tăng số lượng xử lý song song và đồng thời cho các slow filter như OCR, translate vốn đang là bottleneck.
- Quản lý và phân bổ số lượng tiến trình đồng thời hợp lý với tài nguyên phần cứng: 
    - Các tác vụ translate, pdf,.. cơ bản sử dụng tài nguyên không đáng kể; chỉ cần quan tâm tới tác vụ OCR, tác vụ này đặc biệt tiêu tốn tài nguyên CPU
    - Với CPU gồm 6 core, 12 thread, trên lý thuyết có thể dành ra khoảng 9-10 thread cho OCR - mỗi tiến trình OCR một thread. Tuy nhiên triển khai thực tế cho thấy khoảng 8 tiến trình OCR song song là gần đạt max throughput CPU (~100%) nên đây sẽ là con số tối ưu cuối cùng.

- **Ưu điểm**: Cải thiện đáng kể hiệu năng so với v2, thời gian xử lý giảm đáng kể

**Kết quả kiểm thử (100 request đồng thời):**
| Chỉ số | Giá trị |
|:-------|------:|
| Tỷ lệ thành công | 100% |
| Tỷ lệ lỗi | 0% |
| Thời gian phản hồi trung bình | 7,937.4 ms |
| Thời gian xử lý tối thiểu | 1,860 ms |
| Thời gian xử lý tối đa | 14,074 ms |
| Phân vị 95 (p95) | 13,770.3 ms |
| Phân vị 99 (p99) | 13,770.3 ms |

### Phiên bản 4: Tích hợp Caching
- Sử dụng Redis làm cache, dùng hash buffer của hình ảnh làm cache key, translateText làm cache value
- **Ưu điểm**: Giảm thời gian xử lý đáng kể khi cache hit, giảm tải CPU, tránh spam

#### Test số 1 : Cache với 100% Hit Rate
**Kết quả kiểm thử (100 request đồng thời):**
| Chỉ số | Giá trị |
|:-------|------:|
| Tỷ lệ thành công | 100% |
| Tỷ lệ lỗi | 0% |
| Thời gian phản hồi trung bình | 61.3 ms |
| Thời gian xử lý tối thiểu | 15 ms |
| Thời gian xử lý tối đa | 135 ms |
| Phân vị 95 (p95) | 117.9 ms |
| Phân vị 99 (p99) | 130.3 ms |

#### Test số 2 : Cache với 50% Hit Rate
**Kết quả kiểm thử (100 request đồng thời):**
| Chỉ số | Giá trị |
|:-------|------:|
| Tỷ lệ thành công | 100% |
| Tỷ lệ lỗi | 0% |
| Thời gian phản hồi trung bình | 8,056.4 ms |
| Thời gian xử lý tối thiểu | 2,123 ms |
| Thời gian xử lý tối đa | 13,825 ms |
| Phân vị 95 (p95) | 13,497.6 ms |
| Phân vị 99 (p99) | 13,770.3 ms |

## Phân tích hiệu năng

| Phiên bản | Tỷ lệ thành công | Thời gian trung bình | Thời gian tối thiểu | Thời gian tối đa | p95 | p99 |
|:----------|----------------:|--------------------:|-------------------:|----------------:|-----:|-----:|
| v1: Express.js cơ bản | 66% | 10,363.5 ms | 3,762 ms | 12,621 ms | 12,213.1 ms | 12,459.8 ms |
| v2: Message Queue tuần tự | 100% | 33,793.8 ms | 1,204 ms | 66,025 ms | 62,964 ms | 65,533.7 ms |
| v3: Pipe and Filter | 100% | 7,937.4 ms | 1,860 ms | 14,074 ms | 13,770.3 ms | 13,770.3 ms |
| v4_1: 100% Cache Hit | 100% | 61.3 ms | 15 ms | 135 ms | 117.9 ms | 130.3 ms |
| v4_2: 50% Cache Hit | 100% | 8,056.4 ms | 2,123 ms | 13,825 ms | 13,497.6 ms | 13,770.3 ms |


### Phân tích chi tiết
1. **Thời gian tối thiểu**: 
   * v4_1 có thời gian tối thiểu thấp nhất (15 ms) do cache hit 100%
   * Thời gian tối thiểu của v2 (1,204 ms) thấp hơn v1 (3,762 ms) do message queue giúp phân tải hiệu quả, thấp hơn v3 (1,860 ms) do chỉ có một tiến trình ocr độc lập.

2. **Thời gian tối đa**:
   * v2 (66,025 ms) > v3 (14,074 ms) > v1 (12,621 ms)
   * Message Queue tuần tự trong v2 tạo ra thời gian xử lý cao nhất, v3 có nhiều tiến trình xử lý song song nhưng quản lý ở mức độ phù hợp, v1 có thời gian tối đa thấp hơn do không có quản lý tài nguyên, sử dụng tối đa tài nguyên CPU có thể (không tối ưu).

3. **Thời gian trung bình**:
   * v4_1 (61.3 ms) < v3 (7,937.4 ms) < v4_2 (8,056.4 ms) < v1 (10,363.5 ms) < v2 (33,793.8 ms)
   * Có thể thấy v4_1 có thời gian cực nhanh, trong khi v4_2 có thời gian tương tự v3, do thêm quá trình check cache với toàn bộ request, giảm thời gian xử lý với các request cache hit nhưng tăng thời gian xử lý với các request cache miss, tổng thể không cải thiện nhiều thời gian cho nhóm lớn người dùng yêu cầu cùng lúc, nhưng đặc biệt hiệu quả với đơn người dùng hoặc nhóm người dùng rải đều yêu cầu trong thời gian dài, ngoài ra cache hit giảm tải cpu vì tránh được tác vụ ocr vốn rất nặng, tránh được người dùng spam ảnh.
   * v1 lộ rõ điểm yếu ở đây khi trước đó có thời gian tối đa thấp hơn v3, nhưng thời gian trung bình lại cao hơn, xét trong trường hợp đang test là 100 request cùng lúc cho thấy tổng thời gian chờ của tất cả request là lâu hơn. Dù v1 đã sử dụng quá mức CPU nhưng vẫn cho ra kết quả kém hơn v3.

4. **Độ ổn định**:
   * v1: Tỷ lệ lỗi 34% do quá tải và xung đột khi nhiều tiến trình cạnh tranh tài nguyên
   * v2, v3, v4: Tỷ lệ lỗi 0%, hệ thống ổn định hoàn toàn

## Nhận xét và đánh giá

### Tác động của Message Queue đơn luồng
- **Ổn định hệ thống**: Giảm tỷ lệ lỗi từ 34% xuống 0% nhờ quản lý luồng xử lý tốt hơn
- **Hiệu năng xử lý**: Giải pháp MQ tuần tự (v2) làm giảm hiệu năng, tăng thời gian xử lý lên 246.8ms
- **Đánh đổi**: Cải thiện độ ổn định lấy đi hiệu năng nếu không có chiến lược phân phối phù hợp, tuy nhiên đây chỉ là bước đệm nhằm hướng tới những điểm ưu việt của Kafka sẽ được triển khai thêm sau đó (Horizontal Scaling, Parallel Processing,...)

### Tối ưu Pipe and Filter Pattern
- **Cải thiện hiệu năng**: Giảm thời gian trung bình 76.5% so với v2 (từ 33,793.8 ms xuống 7,937.4 ms)
- **Cân bằng tài nguyên**: Quản lý hiệu quả số lượng worker cho từng filter
- **Thời gian xử lý ổn định**: Mặc dù tối đa tới 14,074 ms nhưng ổn định hơn nhiều so với v2, và có mean thấp nhất (không tính v4_1)

### Hiệu quả của Caching
- **Đối với lượng lớn yêu cầu cùng lúc**: Giảm thời gian xử lý với các request cache hit, nhưng tăng thời gian xử lý với các request cache miss, do cơ phải chờ nhau trong hàng chờ nên tổng thể không cải thiện nhiều thời gian cho nhóm lớn người dùng yêu cầu cùng lúc.
- **Đối với yêu cầu đơn lẻ hoặc nhóm rải đều**: Hiệu quả rõ rệt nếu cache hit, thời gian phản hồi giảm xuống còn 10 ms - 61.3 ms

## Các phần triển khai thêm
Ngoài  các phần triển khai trong yêu cầu, nhóm còn thực hiện triển khai thêm một số phần nữa:
- **Microservice**: Tận dụng kafka, dễ dàng triển khai consumer OCR thành service riêng, vì đây là tác vụ nặng nhất, đặc biệt tiêu tốn tài nguyên phần cứng, dễ dàng sử dụng tối đa cpu trong khi những tác vụ còn lại chưa sử dụng đáng kể và còn dư nhiều tài nguyên. Với triển khai microservice này, có thể dễ dàng horizontal scale cho consumer OCR - bottleneck lớn nhất. Tất cả các phần còn lại của ứng dụng đều sử dụng rất ít tài nguyên, được gộp lại chạy chung (Compute Resource Consolidation).
- **Rate Limiting**: tận dụng Redis đã triển khai trước đó để triển khai thêm Rate Limiting với Sliding Window. Triển khai này cũng đặc biệt quan trọng với ứng dụng có mức sử dụng tài nguyên cao này.
- **Health Endpoint**: Triển khai health endpoint cho ứng dụng và các service OCR, kết hợp Prometheus và Grafana, dễ dàng theo dõi được tình trạng hệ thống trên một dashboard duy nhất.
- **Retry Pattern**: Triển khai cơ chế Retry Pattern với Exponential Backoff và Jitter để tăng tính ổn định khi gặp lỗi tạm thời. Các thành phần như translate và pdf creation được đóng gói bằng hàm `withRetry` cho phép tự động thử lại khi gặp lỗi mạng hoặc lỗi tạm thời. Đặc biệt, với dịch vụ translate, cơ chế này chỉ thử lại đối với các lỗi mạng (`ECONNRESET`, `ETIMEDOUT`) hoặc giới hạn tốc độ (mã lỗi 429), giúp cải thiện đáng kể độ tin cậy của hệ thống. Kết hợp với Prometheus metrics, hệ thống còn có thể theo dõi và phân tích số lần thử lại cho từng loại hoạt động, giúp phát hiện và xử lý các vấn đề tiềm ẩn.

Các triển khai này không trực tiếp tăng hiệu suất ứng dụng nhưng giúp cho ứng dụng có thể mở rộng và phát triển trong tương lai và đảm bảo được độ ổn định của hệ thống.