var backends = require('./lib/backends'),
    events   = require('events'),
    util     = require('util');

JSON.stringifyCanonical = require('canonical-json');

// generator(key, extra, cb(err, value))
function ResourceStore(backend, generator) {
    if (!(this instanceof ResourceStore)) {
        return new ResourceStore(backend, generator);
    }

    var self = this;

    if (backend && !generator) {
        generator = backend;
        backend   = new ResourceStore.MemoryBackend();
    }

    if (typeof backend == 'string') {
        var dirname  = backend;
        self.backend = new ResourceStore.FileBackend(dirname);
    } else {
        self.backend = backend;
    }

    self.generator = generator;
    self._tasks    = {};
    self._running  = {};

    var shouldCache = self.backend.shouldCache;
    if (shouldCache || typeof shouldCache == 'undefined') {
        self._cached = {};
    }
}

util.inherits(ResourceStore, events.EventEmitter);

backends.addTo(ResourceStore);

// cb(err, value, extra)
ResourceStore.prototype.get = function(key, cb) {
    var self = this;

    if (typeof cb != 'function') {
        throw new Error('Callback function not given.');
    }

    self._addTask(key, '_get', cb);
};

// cb(err, value, extra)
ResourceStore.prototype._get = function(key, keyStr, cb) {
    var self = this;

    if (self._cached) {
        var cached = self._cached[keyStr];
        if (cached) {
            process.nextTick(function() {
                cb(null, cached.value, cached);
            });
            return;
        }
    }

    self.backend.get(keyStr, function(err, data, extraKeyInfo) {
        if (err) {
            // Something went wrong in the backend
            cb(err);

        } else if (data === false) {
            // The resource for this key is not stored yet; generate it
            data = extraKeyInfo || {};
            data.key           = key;
            data.createStarted = self._running[keyStr];
            self.generator(key, data, function(err, value) {
                if (err) {
                    cb(err);
                    return;
                }
                data.value         = value;
                data.createEnded   = +new Date;
                data.lastRetrieved = data.createEnded;
                self.backend.set(keyStr, data, function(err) {
                    if (err) {
                        cb(err);
                    } else {
                        if (self._cached) {
                            self._cached[keyStr] = data;
                        }
                        cb(err, data.value, data);
                    }
                });
            });

        } else {
            // The backend already had the resource for this key
            data = util._extend({ wasCached : true }, data);
            cb(err, data.value, data);

        }
    });
};

// cb(err)
ResourceStore.prototype.delete = function(key, cb) {
    var self = this;

    self._addTask(key, '_delete', cb || function() { });
};

ResourceStore.prototype._delete = function(key, keyStr, cb) {
    var self = this;

    self.backend.delete(keyStr, function(err) {
        if (self._cached) {
            delete self._cached[keyStr];
        }
        cb(err);
    });
};

ResourceStore.prototype._addTask = function(key, method, cb) {
    var self = this;

    var task = {
            key    : key,
            method : method,
            cb     : cb
        },
        keyStr = JSON.stringifyCanonical(key);

    if (util.isArray(self._tasks[keyStr])) {
        self._tasks[keyStr].push(task);
    } else {
        self._tasks[keyStr] = [task];
    }

    self._runTask(keyStr);
};

ResourceStore.prototype._runTask = function(keyStr) {
    var self = this;

    if (self._running[keyStr]) {
        return;
    }

    self._running[keyStr] = +new Date;

    var task = self._tasks[keyStr].shift();

    self[task.method](task.key, keyStr, function() {
        task.cb.apply(self, arguments);

        delete self._running[keyStr];
        if (self._tasks[keyStr].length) {
            self._runTask(keyStr);
        } else {
            delete self._tasks[keyStr];
            if (self._cached) {
                delete self._cached[keyStr];
            }
        }
    });
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

        if (typeof cbDone == 'function') {
            cbDone(err, numEntries);
        }

    });
};

module.exports = ResourceStore;
