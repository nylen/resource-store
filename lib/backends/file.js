var crypto = require('crypto'),
    fs     = require('fs-extra'),
    path   = require('path'),
    Walker = require('walker');

fs.jsonfile.spaces = 4;

function FileBackend(dir) {
    if (!(this instanceof FileBackend)) {
        return new FileBackend(dir);
    }

    var self = this;

    self.dir = dir;
}

// cb(err, value, extraKeyInfo)
FileBackend.prototype.get = function(keyStr, cb) {
    var self = this;

    var keyData  = self._keyData(keyStr),
        filename = path.join(self.dir, keyData.jsonFilename);

    fs.readJSON(filename, function(err, value) {
        if (err && err.code == 'ENOENT') {
            // this key isn't in the data store yet
            cb(null, false, {
                // also send the base filename (without the .json extension) so
                // generators can decide to store other files alongside the
                // .json file, if desired
                baseFilename : keyData.baseFilename
            });
        } else if (err) {
            cb(err);
        } else {
            // touch the file so list() can set lastRetrieved
            var ts = new Date / 1000;
            fs.utimes(filename, ts, ts, function(err) {
                // TODO: do we care about err here?
                cb(null, value);
            });
        }
    });
};

// cb(err)
FileBackend.prototype.set = function(keyStr, value, cb) {
    var self = this;

    var keyData = self._keyData(keyStr);

    fs.mkdirp(path.join(self.dir, keyData.filePath), function(err) {
        if (err) return cb(err);

        // TODO: write to temp file then rename
        fs.writeJSON(path.join(self.dir, keyData.jsonFilename), value, function(err) {
            cb(err);
        });
    });
};

FileBackend.prototype.delete = function(keyStr, cb) {
    var self = this;

    var keyData = self._keyData(keyStr);

    fs.unlink(path.join(self.dir, keyData.jsonFilename), function(err) {
        cb(err);
    });
};

FileBackend.prototype._keyData = function(keyStr) {
    var self = this;

    var keyHash = crypto
            .createHash('md5')
            .update(keyStr)
            .digest('hex'),
        filePath = path.join(
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

// cbEntry(err, key, value)
// cbDone(err, numEntries)
FileBackend.prototype.list = function(cbEntry, cbDone) {
    var self = this;

    var walkerDone    = false,
        walkerError   = null,
        numFilesFound = 0,
        numFilesRead  = 0;

    // Ideally we would know our own data keys, but since we store data in
    // hashed files, we don't actually know what they are.  So, just pass null
    // and let the caller (ResourceStore) take care of it.
    var keyStr = null;

    // Since we're doing an async operation on each file, it's possible that
    // walker.on('end') could happen before we've processed every file.  So,
    // track the number of files found and the number of files called, and make
    // sure we only call cbDone when all files have been traversed *and* read.
    function checkIfDone() {
        if (walkerDone && cbDone && numFilesFound == numFilesRead) {
            cbDone(walkerError, numFilesFound);
            cbDone = null;
        }
    }

    Walker(self.dir).on('file', function(file, stat) {
        if (/\b[a-z0-9]{32}\.json$/.test(file)) {
            numFilesFound++;
            fs.readJSON(file, function(err, value) {
                if (!err) {
                    // If we get an error here it could be because the file
                    // doesn't exist any more or because it was partially
                    // written.  Just ignore it, in either case.
                    value.lastRetrieved = +stat.mtime;
                    cbEntry(null, keyStr, value);
                }
                numFilesRead++;
                checkIfDone();
            });
        }
    }).on('end', function() {
        walkerDone = true;
        checkIfDone();
    }).on('error', function(err) {
        walkerDone = true;
        if (err.code != 'ENOENT') {
            // Ignore ENOENT (if the storage directory does not exist yet).
            walkerError = err;
        }
        checkIfDone();
    });
};

module.exports = FileBackend;
