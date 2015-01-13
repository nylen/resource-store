var clone = require('clone');

function MemoryBackend(options) {
    if (!(this instanceof MemoryBackend)) {
        return new MemoryBackend(options);
    }

    var self = this;

    if (!options || typeof options != 'object') {
        options = {};
    }
    if (typeof options.mutable == 'undefined') {
        options.mutable = true;
    }
    self.mutable     = options.mutable;
    self.data        = {};
    self.shouldCache = false;
}

// process.nextTick() keeps Zalgo contained
// http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony

// cb(err, data, extraKeyInfo)
MemoryBackend.prototype.get = function(keyStr, cb) {
    var self = this;

    process.nextTick(function() {
        if (keyStr in self.data) {
            var value = self.data[keyStr];
            value.lastRetrieved = +new Date;
            cb(null, self._wrap(value));
        } else {
            cb(null, false);
        }
    });
};

// cb(err)
MemoryBackend.prototype.set = function(keyStr, value, cb) {
    var self = this;

    process.nextTick(function() {
        self.data[keyStr] = self._wrap(value);
        cb(null);
    });
};

MemoryBackend.prototype.delete = function(keyStr, cb) {
    var self = this;

    process.nextTick(function() {
        if (keyStr in self.data) {
            delete self.data[keyStr];
            cb(null);
        } else {
            cb(new Error(
                'The specified key was not found in the MemoryBackend data store.'));
        }
    });
};

// cbEntry(err, key, value)
// cbDone(err, numEntries)
MemoryBackend.prototype.list = function(cbEntry, cbDone) {
    var self = this;

    var keys = Object.keys(self.data);

    function send(i) {
        process.nextTick(function() {
            if (i == keys.length) {
                cbDone(null, keys.length);
            } else {
                var entry = self.data[keys[i]];
                if (typeof entry != 'undefined') {
                    // This entry could have been deleted
                    cbEntry(null, keys[i], self._wrap(entry));
                }
                send(i + 1);
            }
        });
    }

    send(0);
};

MemoryBackend.prototype._wrap = function(val) {
    var self = this;

    if (self.mutable) {
        return val;
    } else {
        return clone(val);
    }
};

module.exports = MemoryBackend;
