var fs            = require('fs-extra'),
    ResourceStore = require('../index'),
    lib           = require('./lib'),
    mocha         = require('mocha'),
    path          = require('path'),
    should        = require('should');

JSON.stringifyCanonical = require('canonical-json');

describe('ResourceStore with FileBackend', function() {
    var storePath = path.join(__dirname, 'store');

    before(function() {
        lib.store = new ResourceStore(storePath, lib.storeCallback);
    });

    beforeEach(function() {
        lib.generatorCalls = 0;
    });

    after(function() {
        fs.deleteSync(storePath);
    });

    it('should be created correctly', function() {
        lib.store.backend.constructor.should.equal(ResourceStore.FileBackend);
    });

    it('should store basic entries', function(done) {
        lib.testStoreBasicEntries({
            margin : 30,
            extra  : {
                baseFilename : path.join(
                    '89', 'a5',
                    '89a5d6c29115ba547f066e54a82b2412')
            }
        }, done);
    });

    it('should retrieve stored entries', function(done) {
        lib.testRetrieveStoredEntries({
            prop1 : 'value1',
            prop2 : 'value2'
        }, {
            margin : 100
        }, done);
    });

    it('should retrieve stored entries regardless of key order', function(done) {
        lib.testRetrieveStoredEntries({
            prop2 : 'value2',
            prop1 : 'value1'
        }, {
            margin : 300
        }, done);
    });

    it('should list stored entries', function(done) {
        lib.testList1(done);
    });

    it('should touch the file for an entry when it is retrieved', function(done) {
        this.timeout(5000);
        // Instead of having a long delay since my filesystem stores mtimes to
        // the nearest second, back-date the mtime then make sure it gets reset.
        var ts = new Date / 1000 - 30;
        fs.utimesSync(
            path.join(storePath, lib.savedExtraData.baseFilename + '.json'),
            ts, ts);
        lib.testLastRetrieved({
            timeout : 2000,
            margin  : 1000
        }, done);
    });

    it('should handle lots of concurrent requests', function(done) {
        lib.testConcurrentGets(done);
    });

    it('should delete entries', function(done) {
        var baseFilename = '9b/eb/9beb27e6567ce5c79c1fb4d5b765b6d0';
        lib.testDelete(function(keyStr) {
            return fs.existsSync(path.join(storePath, baseFilename + '.json'));
        }, done);
    });

    it('should handle interleaved gets and deletes', function(done) {
        this.timeout(5000);
        lib.testInterleaved(done);
    });

    it('should list stored entries again', function(done) {
        lib.testList2(done);
    });

    it.skip('should delete entries when they expire', function(done) {
        lib.testExpires(done);
    });
});
