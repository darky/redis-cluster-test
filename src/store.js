var _ = require('underscore'),
  asynk = require('async'),
  crypto = require('crypto'),
  minimist = require('minimist'),
  redis = require('redis'),
  redisClient = redis.createClient();

var radio = require('./radio.js');

var LOSE_TIME = 3000;

var singleton = null;

function _becomeGenerator(id, timestamp) {
  if (this.id === id) {
    this.generator = true;
    this.timestamp = timestamp;
  } else if (this.generator && this.timestamp >= timestamp) {
    this.generator = null;
    this.timestamp = null;
  }
  if (this.firstGenerator) {
    clearTimeout(this.firstGenerator);
    this.firstGenerator = null;
  }
}

function _initFirstGenerator() {
  var self = this;
  self.firstGenerator = setTimeout(function() {
    _becomeGenerator.call(self, self.id, +new Date)
  }, LOSE_TIME);
}

function _generateId() {
  var self = this;
  crypto.randomBytes(64, function(err, buffer){
    if (err) throw new Error('Cannot generate peer id');
    self.id = buffer.toString('hex');
  })
}

function _getErrors() {
  var argv = minimist(process.argv.slice(2));
  if (_.indexOf(argv._, 'getErrors') !== -1) {
    redisClient.hgetall('errors', function(err, obj) {
      if (err) return console.error(err);
      console.log(obj);
      redisClient.del('errors', function(err){err ? console.error(err) : null});
    });
  }
}

function _getGenerator(cb) {
  cb(null, this.generator);
}

function _getMessage(cb) {
  redisClient.hlen('errors', function(err, length) {
    if (err) return cb(err);
    cb(null, length);
  })
}

function _getPeerId(cb) {
  cb(null, this.id);
}

function _getRandomPeer(cb) {
  var peers = Object.keys(this.peers),
    randomPeer = _.shuffle(peers)[0];
  cb(null, randomPeer);
}

function _getTimestamp(cb) {
  cb(null, this.timestamp);
}

function _losePeer(id, isGenerator, timestamp) {
  var self = this;
  clearTimeout(self.loseTimers[id]);
  self.loseTimers[id] = setTimeout(function() {
    delete self.peers[id];
    if (isGenerator) {
      _becomeGenerator.call(this, self.id, +new Date);
    }
  }, LOSE_TIME);
}

function _onlinePeer(id, isGenerator, timestamp) {
  if (id !== this.id) this.peers[id] = true;
  if (isGenerator) _becomeGenerator.call(this, id, timestamp);
  _losePeer.call(this, id, isGenerator, timestamp);
}

function _saveMessage(msg) {
  var error = Math.random();
  if (error > 0.85) {
    setTimeout(function() {
      redisClient.hset('errors', msg, error);
    }, Math.floor(Math.random()*1000));
  }
}

module.exports = function() {
  if (!singleton) {
    var obj = {
      firstGenerator: null,
      generator: null,
      id: null,
      loseTimers: {},
      peers: {},
      timestamp: null
    };
    _generateId.call(obj);
    _initFirstGenerator.call(obj);
    _getErrors();
    radio.on('store:get:generator', _getGenerator.bind(obj));
    radio.on('store:get:message', _getMessage);
    radio.on('store:get:peer', _getPeerId.bind(obj));
    radio.on('store:get:random:peer', _getRandomPeer.bind(obj));
    radio.on('store:get:timestamp', _getTimestamp.bind(obj));
    radio.on('store:online:peer', _onlinePeer.bind(obj));
    radio.on('store:add:message', _saveMessage);
    singleton = obj;
  }
  return singleton;
}
