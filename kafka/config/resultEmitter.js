const EventEmitter = require('events');
const { updateJob, JOB_STATUS } = require('../../services/jobTrackingService');

// Create EventEmitter instance
const resultEmitter = new EventEmitter();
resultEmitter.setMaxListeners(100);

resultEmitter.safeCleanup = function(eventName) {
  if (this.listenerCount(eventName) > 0) {
    this.removeAllListeners(eventName);
  }
};

// Update job status when emitting results
const emitResult = (event, data) => {
  resultEmitter.emit(event, data);
  
  // If this is a PDF creation event, update the job status
  if (event.startsWith('pdfCreated-') && data.key) {
    updateJob(data.key, {
      status: JOB_STATUS.COMPLETED,
      result: {
        pdfPath: data.pdfPath
      }
    });
  }
  
  // If this is an error event
  if (event.startsWith('error-') && data.key) {
    updateJob(data.key, {
      status: JOB_STATUS.FAILED,
      error: data.error
    });
  }
};

module.exports = { resultEmitter, emitResult };