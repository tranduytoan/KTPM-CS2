const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { withRetry } = require('./retry');
const { metrics } = require('./metrics');
const logger = require('./logger');

const OUTPUT_DIR = path.resolve(__dirname, '../output/');

function createPDF(text, key) {
    const startTime = Date.now();
    // Check if the output directory exists, if not, create it
    return new Promise((resolve, reject) => {
        withRetry(async () => {
            return new Promise((innerResolve, innerReject) => {
                try {
                    if (!fs.existsSync(OUTPUT_DIR)) {
                        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
                    }
                
                    const outputFile = path.join(OUTPUT_DIR, `output_${key}.pdf`);
                    
                    const doc = new PDFDocument();
                    const stream = fs.createWriteStream(outputFile);
                    doc.pipe(stream);
                    doc.font(path.resolve(__dirname, '../font/Roboto-Regular.ttf'))
                        .fontSize(14)
                        .text(text, 100, 100);
                    doc.end();
                    
                    stream.on('finish', () => innerResolve(outputFile)); // Resolve the promise with the output file path
                    stream.on('error', innerReject);
                } catch (error) {
                    innerReject(error);
                }
            });
        }, {
            maxRetries: 2,
            baseDelay: 500
        })
        .then((outputFile) => {
            metrics.recordProcessingDuration('pdf_creation', 'success', startTime);
            resolve(outputFile);
        })
        .catch(err => {
            metrics.recordProcessingDuration('pdf_creation', 'failure', startTime);
            logger.error(`PDF creation error: ${err.message}`);
            reject(err);
        });
    });
}

module.exports = {
    createPDF
}