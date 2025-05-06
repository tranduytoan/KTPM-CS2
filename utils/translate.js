const translator = require("open-google-translator");
const { withRetry } = require('./retry');
const { metrics } = require('./metrics');
const logger = require('./logger');

translator.supportedLanguages();

function translate(text) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        withRetry(async () => {
            return new Promise((innerResolve, innerReject) => {
                translator
                    .TranslateLanguageData({
                        listOfWordsToTranslate: [text],
                        fromLanguage: "en",
                        toLanguage: "vi",
                    })
                    .then((data) => {
                        metrics.recordProcessingDuration('translate', 'success', startTime);
                        innerResolve(data[0].translation);
                    }).catch((err) => {
                        metrics.retryAttempts.inc({ operation: 'translate' });
                        logger.error(`Translation error: ${err.message}`);
                        innerReject(err);
                    });
            });
        }, {
            maxRetries: 3,
            baseDelay: 1000,
            shouldRetry: (error) => {
                // Only retry on network errors or rate limiting
                return error.code === 'ECONNRESET' || 
                       error.code === 'ETIMEDOUT' || 
                       error.message.includes('429');
            }
        })
        .then(resolve)
        .catch(err => {
            metrics.recordProcessingDuration('translate', 'failure', startTime);
            reject(err);
        });
    });
}

module.exports = {
    translate
}