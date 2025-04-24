const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT_FILE = "./output/output.pdf";

function createPDF(text) {
    // Check if the output directory exists, if not, create it
    const outputDir = path.dirname(OUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(OUT_FILE));
    doc.font(path.resolve(__dirname, '../font/Roboto-Regular.ttf'))
        .fontSize(14)
        .text(text, 100, 100);
    doc.end();
    return OUT_FILE;
}

module.exports = {
    createPDF
}