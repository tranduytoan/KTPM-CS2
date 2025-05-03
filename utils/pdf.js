const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { rejects } = require('assert');

const OUTPUT_DIR = path.resolve(__dirname, '../output/');

function createPDF(text, key) {
    // Check if the output directory exists, if not, create it
    return new Promise((resolve, reject) => {
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
        
        stream.on('finish', () => resolve(outputFile)); // Resolve the promise with the output file path)
        stream.on('error', reject);
    })
}

module.exports = {
    createPDF
}