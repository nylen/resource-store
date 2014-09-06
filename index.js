var crypto = require('crypto'),
    events = require('events'),
    fs     = require('fs-extra'),
    path   = require('path'),
    util   = require('util'),
    Walker = require('walker');

JSON.stringifyCanonical = require('canonical-json');

function ResourceStore(dir, generator/*(key, baseFilename, cb(err, data))*/) {
    var self = this;

    self.generator      = generator;
    self.dir            = dir;
    self.valueCallbacks = {};
    self.running        = {};

    self.on('valueReady', self._valueReady);
}

util.inherits(ResourceStore, events.EventEmitter);

ResourceStore.prototype.get = function(key, cb/*(err, data, baseFilename)*/) {
    var self = this;

    var keyStr = JSON.stringifyCanonical(key);

    if (keyStr in self.valueCallbacks) {
        self.valueCallbacks[keyStr].push(cb);
    } else {
        self.valueCallbacks[keyStr] = [cb];
    }

    if (self.running[keyStr]) {
        return;
    }

    self.running[keyStr] = +new Date;

    var keyData = self._keyData(keyStr);

    fs.exists(keyData.jsonFilename, function(exists) {
        if (exists) {
            fs.readJSON(keyData.jsonFilename, function(err, data) {
                self.emit('valueReady', keyStr, err, data.results, keyData.baseFilename);
            });
        } else {
            fs.mkdirp(keyData.filePath, function(err) {
                if (err) {
                    self.emit('valueReady', keyStr, err);
                    return;
                }
                self.generator(key, keyData.baseFilename, function(err, results) {
                    if (err) {
                        self.emit('valueReady', keyStr, err);
                        return;
                    }
                    var data = {
                        key           : key,
                        createStarted : self.running[keyStr],
                        createEnded   : +new Date,
                        results       : results
                    };
                    fs.writeJSON(keyData.jsonFilename, data, function(err) {
                        if (err) {
                            // show warning?
                        }
                        self.emit('valueReady', keyStr, null, results, keyData.baseFilename);
                    });
                });
            });
        }
    });
};

ResourceStore.prototype._keyData = function(keyStr) {
    var self = this;

    var keyHash = crypto
            .createHash('md5')
            .update(keyStr)
            .digest('hex'),
        filePath = path.resolve(
            self.dir,
            keyHash.substring(0, 2),
            keyHash.substring(2, 4)),
        baseFilename = path.join(filePath, keyHash),
        jsonFilename = baseFilename + '.json';

    return {
        filePath     : filePath,
        baseFilename : baseFilename,
        jsonFilename : jsonFilename
    };
};

ResourceStore.prototype._valueReady = function(keyStr, err, data, baseFilename) {
    var self = this;

    delete self.running[keyStr];
    self.valueCallbacks[keyStr].forEach(function(cb) {
        cb(err, data, baseFilename);
    });
    delete self.valueCallbacks[keyStr];
};

ResourceStore.prototype.list = function(cbData, cbDone) {
    var self = this;

    var walkerDone     = false,
        numFilesFound  = 0,
        numFilesCalled = 0;
    Walker(self.dir).on('file', function(file, stat) {
        var match, baseFilename;
        if (match = file.match(/^(.*\b[a-z0-9]{32})\.json$/)) {
            baseFilename = match[1];
            numFilesFound++;
            fs.readJSON(file, function(err, data) {
                if (!err) {
                    cbData(data.key, data.results, baseFilename, data);
                }
                if (walkerDone && cbDone && numFilesFound == ++numFilesCalled) {
                    cbDone(numFilesCalled);
                    cbDone = null;
                }
            });
        }
    }).on('end', function() {
        walkerDone = true;
        if (cbDone && numFilesFound == numFilesCalled) {
            cbDone(numFilesCalled);
            cbDone = null;
        }
    });
};

module.exports = ResourceStore;
