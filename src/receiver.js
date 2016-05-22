var asynk = require('async'),
  redis = require('redis'),
  subClient = redis.createClient();

var radio = require('./radio.js');

var singleton = null;

function _onlinePeer(id, isGenerator, timestamp) {
  radio.emit('store:online:peer', id, isGenerator, timestamp);
}

function _receiveMessage(id, msg) {
  asynk.waterfall([
    function(next) {radio.emit('store:get:peer', next)},
    function(myId, next) {
      myId === id ? radio.emit('store:add:message', msg) : null;
    }
  ]);
}

module.exports = function() {
  if (!singleton) {
    subClient.on('message', function(channel, message) {
      try {
        var data = JSON.parse(message);
        if (channel === 'online') _onlinePeer(data.id, data.isGenerator, data.timestamp);
        if (channel === 'message') _receiveMessage(data.id, data.msg);
      } catch (e) { }
    });
    subClient.subscribe('message');
    subClient.subscribe('online');
    singleton = true;
  }
}
