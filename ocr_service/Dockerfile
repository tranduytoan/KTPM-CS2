FROM node:18-slim

# Install Tesseract OCR
RUN apt-get update && apt-get install -y tesseract-ocr

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY ocr_service ./ocr_service

EXPOSE 8080

CMD ["node", "ocr_service/index.js"]