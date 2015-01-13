var ResourceStore = require('../index'),
    lib           = require('./lib'),
    mocha         = require('mocha'),
    should        = require('should');

describe('ResourceStore with mutable MemoryBackend', function() {
    before(function() {
        lib.store = new ResourceStore(lib.storeCallback);
    });

    beforeEach(function() {
        lib.generatorCalls = 0;
    });

    require('./batch/memory').queueTests({ mutable : true });
});
