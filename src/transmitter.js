var asynk = require('async'),
  redis = require('redis'),
  pubClient = redis.createClient();

var radio = require('./radio.js');

var MESSAGE_INTERVAL = 500,
  ONLINE_INTERVAL = 1000;

var singleton = null;

function _generateMessage() {
  asynk.forever(function(again) {
    asynk.waterfall([
      function(next) {radio.emit('store:get:generator', next)},
      function(isGenerator, next) {
        isGenerator ? asynk.parallel([
          function(cb) {radio.emit('store:get:message', cb)},
          function(cb) {radio.emit('store:get:random:peer', cb)}
        ], next) : next(null, [null, null]);
      },
      function(result, next) {
        var message = result[0], peerId = result[1];
        if (peerId) pubClient.publish('message', JSON.stringify({id: peerId, msg: message}));
        setTimeout(again, MESSAGE_INTERVAL);
      }
    ])
  });
}

function _passOnline() {
  asynk.forever(function(again) {
    asynk.parallel([
      function(next) {radio.emit('store:get:peer', next)},
      function(next) {radio.emit('store:get:generator', next)},
      function(next) {radio.emit('store:get:timestamp', next)}
    ], function(err, result) {
      var peerId = result[0], isGenerator = result[1], timestamp = result[2];
      pubClient.publish('online', JSON.stringify({id: peerId, isGenerator: isGenerator, timestamp: timestamp}));
      setTimeout(again, ONLINE_INTERVAL);
    });
  });
}

module.exports = function() {
  if (!singleton) {
    _passOnline();
    _generateMessage();
    singleton = true;
  }
}
