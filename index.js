var backends = require('./lib/backends'),
    events   = require('events'),
    util     = require('util');

JSON.stringifyCanonical = require('canonical-json');

// generator(key, extra, cb(err, value))
function ResourceStore(backend, generator) {
    var self = this;

    if (backend && !generator) {
        generator = backend;
        backend = new ResourceStore.MemoryBackend();
    }

    if (typeof backend == 'string') {
        var dirname  = backend;
        self.backend = new ResourceStore.FileBackend(dirname);
    } else {
        self.backend = backend;
    }

    self.generator      = generator;
    self.valueCallbacks = {};
    self.running        = {};

    self.on('valueReady', self._valueReady);
}

util.inherits(ResourceStore, events.EventEmitter);

backends.addTo(ResourceStore);

// cb(err, value, extra)
ResourceStore.prototype.get = function(key, cb) {
    var self = this;

    var keyStr = JSON.stringifyCanonical(key);

    if (util.isArray(self.valueCallbacks[keyStr])) {
        self.valueCallbacks[keyStr].push(cb);
    } else {
        self.valueCallbacks[keyStr] = [cb];
    }

    if (self.running[keyStr]) {
        return;
    }

    self.running[keyStr] = +new Date;

    self.backend.get(keyStr, function(err, data, extraKeyInfo) {
        if (err) {
            // Something went wrong in the backend
            self.emit('valueReady', keyStr, err);

        } else if (data === false) {
            // The resource for this key is not stored yet; generate it
            data = extraKeyInfo || {};
            data.key           = key;
            data.createStarted = self.running[keyStr];
            self.generator(key, data, function(err, value) {
                if (err) {
                    self.emit('valueReady', keyStr, err);
                    return;
                }
                data.value       = value;
                data.createEnded = +new Date;
                self.backend.set(keyStr, data, function(err) {
                    if (err) {
                        self.emit('valueReady', keyStr, err);
                    } else {
                        self.emit('valueReady', keyStr, err, data.value, data);
                    }
                });
            });

        } else {
            // The backend already had the resource for this key
            data.wasCached = true;
            self.emit('valueReady', keyStr, err, data.value, data);

        }
    });
};

ResourceStore.prototype._valueReady = function(keyStr, err, value, extra) {
    var self = this;

    delete self.running[keyStr];
    self.valueCallbacks[keyStr].forEach(function(cb) {
        cb(err, value, extra);
    });
    delete self.valueCallbacks[keyStr];
};

// cbEntry(err, key, value, extra)
// cbDone(err, numEntries)
ResourceStore.prototype.list = function(cbEntry, cbDone) {
    var self = this;

    // TODO: error handling?  if an error is passed to cbEntry, what should we
    // do?  not call cbEntry any more times?  call cbDone immediately?  wait
    // until cbDone is called by the backend, then call it with the error we
    // save from cbEntry?

    self.backend.list(function(err, key, data) {

        if (err) {
            cbEntry(err);
        } else {
            // The backend will send string keys, if it knows its own keys at
            // all (for example, FileBackend stores data in files named by the
            // MD5 hash of the key).  We want the object keys, which we can
            // always get from what we saved to the backend earlier.
            //
            // If we did happen to need the string key for anything, this would
            // be the place to get it if the backend doesn't store it.  That
            // way the backend doesn't need to care about the structure of the
            // data we're storing in it.
            // if (typeof key != 'string') {
            //     key = JSON.stringifyCanonical(data.key);
            // }
            cbEntry(null, data.key, data.value, data);
        }

    }, function(err, numEntries) {

        cbDone(err, numEntries);

    });
};

module.exports = ResourceStore;
