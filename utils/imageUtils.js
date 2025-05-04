const fs = require('fs');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);

/**
 * Read an image file and return its buffer
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Buffer>} - Image buffer
 */
const getImageBufferFromPath = async (imagePath) => {
  try {
    return await readFileAsync(imagePath);
  } catch (error) {
    throw new Error(`Error reading image file: ${error.message}`);
  }
};

module.exports = {
  getImageBufferFromPath
};
