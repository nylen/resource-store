var clone         = require('clone'),
    ResourceStore = require('../index'),
    mocha         = require('mocha'),
    should        = require('should');

JSON.stringifyCanonical = require('canonical-json');

describe('ResourceStore with MemoryBackend', function() {
    var savedBy = 'saved by ResourceStore during tests',
        timeout = 300,
        simpleStore,
        savedExtraData,
        generatorCalls = 0;

    before(function() {
        simpleStore = new ResourceStore(function(key, extra, cb) {
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

    it('should be created correctly', function() {
        simpleStore.backend.constructor.should.equal(ResourceStore.MemoryBackend);
    });

    it('should store basic entries', function(done) {
        simpleStore.get({
            prop1 : 'value1',
            prop2 : 'value2'
        }, function(err, data, extra) {
            should.not.exist(err);
            data.should.eql({
                prop1    : 'value1',
                prop2    : 'value2',
                _savedBy : savedBy
            });
            generatorCalls.should.equal(1);

            savedExtraData = clone(extra);

            var date   = +new Date,
                margin = 10; // msec
            extra.createStarted.should.be.within(
                date - timeout - margin,
                date - timeout);
            extra.createEnded.should.be.within(
                date - margin,
                date);

            delete extra.createStarted;
            delete extra.createEnded;

            extra.should.eql({
                key : {
                    prop1 : 'value1',
                    prop2 : 'value2'
                },
                value : {
                    prop1    : 'value1',
                    prop2    : 'value2',
                    _savedBy : savedBy
                }
            });

            done();
        });
    });

    it('should retrieve stored entries', function(done) {
        simpleStore.get({
            prop1 : 'value1',
            prop2 : 'value2'
        }, function(err, data, extra) {
            should.not.exist(err);
            data.should.eql({
                prop1    : 'value1',
                prop2    : 'value2',
                _savedBy : savedBy
            });
            extra.lastRetrieved.should.be.approximately(
                +new Date,
                10);
            savedExtraData.lastRetrieved = extra.lastRetrieved;
            extra.should.eql(savedExtraData);
            generatorCalls.should.equal(0);
            done();
        });
    });

    it('should retrieve stored entries regardless of key order', function(done) {
        simpleStore.get({
            prop2 : 'value2',
            prop1 : 'value1'
        }, function(err, data, extra) {
            should.not.exist(err);
            data.should.eql({
                prop1    : 'value1',
                prop2    : 'value2',
                _savedBy : savedBy
            });
            extra.lastRetrieved.should.be.approximately(
                savedExtraData.lastRetrieved,
                20);
            savedExtraData.lastRetrieved = extra.lastRetrieved;
            extra.should.eql(savedExtraData);
            generatorCalls.should.equal(0);
            done();
        });
    });

    it('should list stored entries', function(done) {
        var list = [];
        simpleStore.list(function(err, key, value, extra) {
            list.push({
                key   : key,
                value : value,
                extra : extra
            });
            savedExtraData.lastRetrieved = extra.lastRetrieved;
        }, function(err) {
            list.should.eql([
                {
                    key : {
                        prop1 : 'value1',
                        prop2 : 'value2'
                    },
                    value : {
                        prop1    : 'value1',
                        prop2    : 'value2',
                        _savedBy : savedBy
                    },
                    extra : savedExtraData
                }
            ]);
            done();
        });
    });

    it('should set lastRetrieved for an entry when it is retrieved', function(done) {
        setTimeout(function() {
            simpleStore.get({
                prop1 : 'value1',
                prop2 : 'value2'
            }, function(err, data, extra) {
                should.not.exist(err);
                data.should.eql({
                    prop1    : 'value1',
                    prop2    : 'value2',
                    _savedBy : savedBy
                });

                var list = [];
                simpleStore.list(function(err, key, value, extra) {
                    list.push({
                        key   : key,
                        value : value,
                        extra : extra
                    });

                    extra.lastRetrieved.should.be.approximately(
                        savedExtraData.lastRetrieved + 200,
                        20);
                    savedExtraData.lastRetrieved = extra.lastRetrieved;
                }, function(err) {
                    list.should.eql([
                        {
                            key : {
                                prop1 : 'value1',
                                prop2 : 'value2'
                            },
                            value : {
                                prop1    : 'value1',
                                prop2    : 'value2',
                                _savedBy : savedBy
                            },
                            extra : savedExtraData
                        }
                    ]);
                    generatorCalls.should.equal(0);
                    done();
                });
            });
        }, 200);
    });

    it('should handle lots of concurrent requests', function(done) {
        var origTimeout = timeout,
            maxTimeout  = timeout * 2,
            numGets     = 0,
            numDone     = 0,
            startAt     = +new Date;

        function next() {
            if (numGets == ++numDone) {
                generatorCalls.should.equal(5);
                done();
            }
        }

        for (var i = 0; i < 100; i++) {
            for (var k = 0; k < 5; k++) {
                (function(key) {
                    numGets++;
                    simpleStore.get(key, function(err, data, extra) {
                        data.should.eql({
                            concurrent : key.concurrent,
                            _savedBy   : savedBy
                        });
                        extra.createStarted.should.be.approximately(
                            startAt,
                            50);
                        extra.createEnded.should.be.approximately(
                            startAt + origTimeout,
                            50);
                        next();
                    });
                })({ concurrent : 'test' + k });
            }
            // Can't do this because the calls to the generator are async
            // timeout = Math.round(Math.random() * maxTimeout);
        }
    });

    it('should list stored entries again', function(done) {
        var list = [];
        simpleStore.list(function(err, key, value, extra) {
            list.push({
                key   : key,
                value : value
            });
        }, function(err) {
            list.sort(function(a, b) {
                a = JSON.stringifyCanonical(a.key);
                b = JSON.stringifyCanonical(b.key);
                if (a < b) {
                    return -1;
                } else if (a > b) {
                    return 1;
                } else {
                    return 0;
                }
            });
            list.should.eql([
                {
                    key : {
                        concurrent : 'test0'
                    },
                    value : {
                        concurrent : 'test0',
                        _savedBy   : savedBy
                    }
                }, {
                    key : {
                        concurrent : 'test1'
                    },
                    value : {
                        concurrent : 'test1',
                        _savedBy   : savedBy
                    }
                }, {
                    key : {
                        concurrent : 'test2'
                    },
                    value : {
                        concurrent : 'test2',
                        _savedBy   : savedBy
                    }
                }, {
                    key : {
                        concurrent : 'test3'
                    },
                    value : {
                        concurrent : 'test3',
                        _savedBy   : savedBy
                    }
                }, {
                    key : {
                        concurrent : 'test4'
                    },
                    value : {
                        concurrent : 'test4',
                        _savedBy   : savedBy
                    }
                }, {
                    key : {
                        prop1 : 'value1',
                        prop2 : 'value2'
                    },
                    value : {
                        prop1    : 'value1',
                        prop2    : 'value2',
                        _savedBy : savedBy
                    }
                }
            ]);
            done();
        });
    });
});
