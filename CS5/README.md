# CASE STUDY 5

International Conference on Software Engineering ([ICSE](https://www.icse-conferences.org/)) là một hội nghị uy tín trong ngành Công nghệ phần mềm. Nhiệm vụ trong bài này là dựng một crawler có thể lấy thông tin tất cả bài báo theo dữ liệu yêu cầu như database (db.sql) tương ứng.  

## Gợi ý triển khai

Ngoài cách crawl trên trang chủ, có thể sử dụng [trang web này](https://ieeexplore.ieee.org/xpl/conhome/1000691/all-proceedings) để thu thập dữ liệu cần sử dụng. Các bạn có thể dùng các công cụ như [scrapy](https://scrapy.org/) (Python), [cheerio](https://github.com/cheeriojs/cheerio) (NodeJS), [Selenium](https://www.selenium.dev/), v.v.

Các trang web trên có thể chặn lưu lượng truy cập bất thường, với vấn đề này có thể sử dụng proxy, VPN hoặc Tor, v.v.

## Yêu cầu triển khai

| Mức độ | Mô tả |
|--|--|
| ![Static Badge](https://img.shields.io/badge/REQUIRED-easy-green) | Triển khai được crawler cơ bản, thu thập tự động (có thể bị chặn) |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-easy-green) | Đánh giá và nêu nguyên nhân của các vấn đề gặp phải |
| ![Static Badge](https://img.shields.io/badge/REQUIRED-hard-red) | Cải tiến và so sánh hiệu năng với phiên bản ban đầu |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-easy-green) | Tối ưu quá trình đọc ghi database |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-medium-yellow) | Song song hoá (đa luồng) quá trình crawl |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-medium-yellow) | Giải quyết vấn đề crawler bị trang web chặn khi truy cập quá nhiều bằng một số kỹ thuật hoặc design pattern tương ứng |
| ![Static Badge](https://img.shields.io/badge/OPTIONAL-medium-yellow) | Đánh giá các giải pháp tối ưu khác nhau |
  

Ngoài ra, các bạn có thể tuỳ chọn bổ sung thêm một số phần triển khai khác.