var ResourceStore = require('../index'),
    lib           = require('./lib'),
    mocha         = require('mocha'),
    path          = require('path'),
    should        = require('should');

describe('ResourceStore with empty FileBackend', function() {
    var storePath = path.join(__dirname, 'store-nonexistent');

    before(function() {
        lib.store = new ResourceStore(storePath, lib.storeCallback);
    });

    beforeEach(function() {
        lib.generatorCalls = 0;
    });

    it('should not contain any entries', function(done) {
        lib.store.list(function(err, key, value, extra) {
            throw new Error(
                'The store should not contain any values.');
        }, function(err) {
            should.not.exist(err);
            done();
        });
    });
});
