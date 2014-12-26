var ResourceStore = require('../index'),
    lib           = require('./lib'),
    mocha         = require('mocha'),
    should        = require('should');

JSON.stringifyCanonical = require('canonical-json');

describe('ResourceStore with MemoryBackend', function() {
    before(function() {
        lib.store = new ResourceStore(lib.storeCallback);
    });

    beforeEach(function() {
        lib.generatorCalls = 0;
    });

    it('should be created correctly', function() {
        lib.store.backend.constructor.should.equal(ResourceStore.MemoryBackend);
    });

    it('should store basic entries', function(done) {
        lib.testStoreBasicEntries({
            margin : 10
        }, done);
    });

    it('should retrieve stored entries', function(done) {
        lib.testRetrieveStoredEntries({
            prop1 : 'value1',
            prop2 : 'value2'
        }, {
            margin : 10
        }, done);
    });

    it('should retrieve stored entries regardless of key order', function(done) {
        lib.testRetrieveStoredEntries({
            prop2 : 'value2',
            prop1 : 'value1'
        }, {
            margin : 20
        }, done);
    });

    it('should list stored entries', function(done) {
        lib.testList1(done);
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
