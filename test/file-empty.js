var ResourceStore = require('../index'),
    mocha         = require('mocha'),
    path          = require('path'),
    should        = require('should');

describe('ResourceStore with empty FileBackend', function() {
    var storePath = path.join(__dirname, 'store-nonexistent'),
        simpleStore;

    before(function() {
        simpleStore = new ResourceStore(
            storePath,
            function(key, extra, cb) {
                generatorCalls++;
                setTimeout(function() {
                    var value = clone(key);
                    value._savedBy = savedBy;
                    cb(null, value);
                }, timeout);
            });
    });

    beforeEach(function() {
        generatorCalls = 0;
    });

    it('should not contain any entries', function(done) {
        simpleStore.list(function(err, key, value, extra) {
            throw new Error(
                'The store should not contain any values.');
        }, function(err) {
            should.not.exist(err);
            done();
        });
    });
});
