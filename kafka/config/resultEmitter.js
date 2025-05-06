const EventEmitter = require('events');

const resultEmitter = new EventEmitter();
resultEmitter.setMaxListeners(100);

resultEmitter.safeCleanup = function(eventName) {
  if (this.listenerCount(eventName) > 0) {
    this.removeAllListeners(eventName);
  }
};

module.exports = { resultEmitter };