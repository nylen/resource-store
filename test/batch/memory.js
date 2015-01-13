var ResourceStore = require('../../index'),
    lib           = require('../lib'),
    mocha         = require('mocha');

exports.queueTests = function(opts) {
    it('should be created correctly', function() {
        lib.store.backend.constructor.should.equal(ResourceStore.MemoryBackend);
    });

    it('should store basic entries', function(done) {
        lib.testStoreBasicEntries({
            margin  : 10,
            mutable : opts.mutable
        }, done);
    });

    it('should retrieve stored entries', function(done) {
        lib.testRetrieveStoredEntries({
            prop1 : 'value1',
            prop2 : 'value2'
        }, {
            margin  : 10,
            mutable : opts.mutable
        }, done);
    });

    it('should retrieve stored entries regardless of key order', function(done) {
        lib.testRetrieveStoredEntries({
            prop2 : 'value2',
            prop1 : 'value1'
        }, {
            margin  : 20,
            mutable : opts.mutable
        }, done);
    });

    it('should list stored entries', function(done) {
        lib.testList1({ mutable : opts.mutable }, done);
    });

    it('should set lastRetrieved for an entry when it is retrieved', function(done) {
        lib.testLastRetrieved({
            timeout : 200,
            margin  : 20
        }, done);
    });

    it('should handle lots of concurrent requests', function(done) {
        lib.testConcurrentGets(done);
    });

    it('should delete entries', function(done) {
        lib.testDelete(function(keyStr) {
            return !!lib.store.backend.data[keyStr];
        }, done);
    });

    it('should delete entries without a callback', function(done) {
        lib.testDeleteWithoutCallback(done);
    });

    it('should handle interleaved gets and deletes', function(done) {
        this.timeout(5000);
        lib.testInterleaved(done);
    });

    it('should list stored entries again', function(done) {
        lib.testList2(done);
    });

    it('should allow getting and removing non-object keys', function(done) {
        lib.withTimeout(100, function(done) {
            lib.testNonObjectKeys(done);
        }, done);
    });
};
