var async  = require('async'),
    clone  = require('clone'),
    should = require('should');

exports.savedBy        = 'saved by ResourceStore during tests';
exports.timeout        = 300;
exports.generatorCalls = 0;

exports.store          = null;
exports.savedExtraData = null;
exports.firstValue     = null;
exports.valueTemplate  = null;

exports.storeCallback = function(key, extra, cb) {
    exports.generatorCalls++;
    setTimeout(function() {
        var value = exports.valueTemplate || clone(key);
        if (value && typeof value == 'object') {
            value._savedBy = exports.savedBy;
        }
        cb(null, value);
    }, exports.timeout);
};

exports.testStoreBasicEntries = function(opts, done) {
    var key = {
            prop1 : 'value1',
            prop2 : 'value2'
        },
        expectedValue = {
            prop1    : 'value1',
            prop2    : 'value2',
            _savedBy : exports.savedBy
        };

    exports.valueTemplate = clone(key);

    exports.store.get(key, function(err, value, extra) {
        should.not.exist(err);
        value.should.eql(expectedValue);
        if (opts.mutable) {
            value.should.equal(exports.valueTemplate);
            exports.firstValue = value;
        }
        exports.valueTemplate = null;
        exports.generatorCalls.should.equal(1);

        exports.savedExtraData = clone(extra);
        exports.savedExtraData.wasCached = true;

        if (opts.mutable) {
            extra = clone(extra);
        }

        var date   = +new Date,
            margin = opts.margin; // msec
        extra.createStarted.should.be.within(
            date - exports.timeout - opts.margin,
            date - exports.timeout);
        extra.createEnded.should.be.within(
            date - opts.margin,
            date);
        extra.lastRetrieved.should.be.within(
            date - opts.margin,
            date);

        delete extra.createStarted;
        delete extra.createEnded;
        delete extra.lastRetrieved;

        var expectedExtra = {
            key : {
                prop1 : 'value1',
                prop2 : 'value2'
            },
            value : {
                prop1    : 'value1',
                prop2    : 'value2',
                _savedBy : exports.savedBy
            }
        };

        if (opts.extra) {
            for (var k in opts.extra) {
                expectedExtra[k] = opts.extra[k];
            }
        }

        extra.should.eql(expectedExtra);

        done();
    });
};

exports.testRetrieveStoredEntries = function(key, opts, done) {
    if (typeof opts == 'function') {
        done = opts;
        opts = {};
    }
    exports.store.get(key, function(err, value, extra) {
        should.not.exist(err);
        value.should.eql({
            prop1    : 'value1',
            prop2    : 'value2',
            _savedBy : exports.savedBy
        });
        if (opts.mutable) {
            value.should.equal(exports.firstValue);
        }
        if (opts.margin) {
            extra.lastRetrieved.should.be.approximately(
                +new Date,
                opts.margin);
        }
        exports.savedExtraData.lastRetrieved = extra.lastRetrieved;
        extra.should.eql(exports.savedExtraData);
        exports.generatorCalls.should.equal(0);
        done();
    });
};

exports.testList1 = function(opts, done) {
    if (typeof opts == 'function') {
        done = opts;
        opts = {};
    }
    var list = [];
    exports.store.list(function(err, key, value, extra) {
        list.push({
            key   : key,
            value : value,
            extra : extra
        });
        exports.savedExtraData.lastRetrieved = extra.lastRetrieved;
        delete exports.savedExtraData.wasCached;
    }, function(err, numEntries) {
        should.not.exist(err);
        list.should.eql([
            {
                key : {
                    prop1 : 'value1',
                    prop2 : 'value2'
                },
                value : {
                    prop1    : 'value1',
                    prop2    : 'value2',
                    _savedBy : exports.savedBy
                },
                extra : exports.savedExtraData
            }
        ]);
        numEntries.should.equal(1);
        if (opts.mutable) {
            list[0].value.should.equal(exports.firstValue);
        }
        done();
    });
};

exports.testLastRetrieved = function(opts, done) {
    setTimeout(function() {
        exports.store.get({
            prop1 : 'value1',
            prop2 : 'value2'
        }, function(err, value, extra) {
            should.not.exist(err);
            value.should.eql({
                prop1    : 'value1',
                prop2    : 'value2',
                _savedBy : exports.savedBy
            });
            extra.wasCached.should.eql(true);
            extra.lastRetrieved.should.be.approximately(
                +new Date,
                opts.margin);
            exports.savedExtraData.lastRetrieved = extra.lastRetrieved;

            var list = [];
            exports.store.list(function(err, key, value, extra) {
                list.push({
                    key   : key,
                    value : value,
                    extra : extra
                });

                extra.lastRetrieved.should.be.approximately(
                    exports.savedExtraData.lastRetrieved,
                    opts.margin);
                exports.savedExtraData.lastRetrieved = extra.lastRetrieved;
            }, function(err, numEntries) {
                should.not.exist(err);
                list.should.eql([
                    {
                        key : {
                            prop1 : 'value1',
                            prop2 : 'value2'
                        },
                        value : {
                            prop1    : 'value1',
                            prop2    : 'value2',
                            _savedBy : exports.savedBy
                        },
                        extra : exports.savedExtraData
                    }
                ]);
                numEntries.should.equal(1);
                exports.generatorCalls.should.equal(0);
                done();
            });
        });
    }, opts.timeout);
};

exports.testConcurrentGets = function(done) {
    var origTimeout = exports.timeout,
        maxTimeout  = exports.timeout * 2,
        numGets     = 0,
        numDone     = 0,
        startAt     = +new Date;

    function next() {
        if (numGets == ++numDone) {
            exports.generatorCalls.should.equal(5);
            done();
        }
    }

    for (var i = 0; i < 100; i++) {
        for (var k = 0; k < 5; k++) {
            (function(key) {
                numGets++;
                exports.store.get(key, function(err, value, extra) {
                    value.should.eql({
                        concurrent : key.concurrent,
                        _savedBy   : exports.savedBy
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
        // exports.timeout = Math.round(Math.random() * maxTimeout);
    }
};

exports.testDelete = function(isKeyPresent, done) {
    var key    = { concurrent : 'test2' },
        keyStr = JSON.stringifyCanonical(key);

    isKeyPresent(keyStr).should.equal(true);
    exports.store.delete(key, function(err) {
        should.not.exist(err);
        isKeyPresent(keyStr).should.equal(false);
        done();
    });
};

exports.testDeleteWithoutCallback = function(done) {
    var key = { concurrent : 'test2' };
    exports.store.delete(key);
    setTimeout(done, 100);
};

exports.testInterleaved = function(done) {
    var calls     = 0,
        doneCalls = 0,
        expected  = {
            interleaved : true,
            _savedBy    : exports.savedBy
        };

    function checkIfDone() {
        if (++doneCalls == 3) {
            done();
        }
    }

    function list(i, listResults, cb) {
        if (typeof listResults == 'function') {
            cb = listResults;
            listResults = null;
        }
        if (!listResults) {
            listResults = {
                incl : 0,
                excl : 0
            };
        }
        var foundInterleaved = 0;
        if (i < 10) {
            exports.store.list(function(err, key, value, extra) {
                should.exist(value);
                should.exist(extra);
                if (key.interleaved) {
                    foundInterleaved = true;
                }
            }, function(err, numEntries) {
                should.not.exist(err);
                listResults[foundInterleaved ? 'incl' : 'excl']++;
                list(i + 1, listResults, cb);
                numEntries.should.equal(foundInterleaved ? 6 : 5);
            });
        } else {
            cb(listResults);
        }
    }

    list(0, function(listResults) {
        listResults.excl.should.be.above(0);
        checkIfDone();
    });

    exports.store.get({ interleaved : true }, function(err, value, extra) {
        should.not.exist(err);
        value.should.eql(expected);
        (++calls).should.equal(1);
        exports.generatorCalls.should.equal(1);
        list(0, function(listResults) {
            listResults.incl.should.be.above(0);
            checkIfDone();
        });
    });

    setTimeout(function() {
        exports.store.get({ interleaved : true }, function(err, value, extra) {
            should.not.exist(err);
            value.should.eql(expected);
            (++calls).should.equal(2);
            exports.generatorCalls.should.equal(1);
        });

        exports.store.delete({ interleaved : true }, function(err) {
            should.not.exist(err);
            (++calls).should.equal(3);
        });

        exports.store.get({ interleaved : true }, function(err, value, extra) {
            should.not.exist(err);
            value.should.eql(expected);
            (++calls).should.equal(4);
            exports.generatorCalls.should.equal(2);
        });

        exports.store.get({ interleaved : true }, function(err, value, extra) {
            should.not.exist(err);
            value.should.eql(expected);
            (++calls).should.equal(5);
            exports.generatorCalls.should.equal(2);
        });

        exports.store.delete({ interleaved : true }, function(err) {
            should.not.exist(err);
            (++calls).should.equal(6);
            checkIfDone();
        });
    }, 500);
};

exports.testList2 = function(done) {
    var list = [];
    exports.store.list(function(err, key, value, extra) {
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
                    _savedBy   : exports.savedBy
                }
            }, {
                key : {
                    concurrent : 'test1'
                },
                value : {
                    concurrent : 'test1',
                    _savedBy   : exports.savedBy
                }
            }, {
                key : {
                    concurrent : 'test3'
                },
                value : {
                    concurrent : 'test3',
                    _savedBy   : exports.savedBy
                }
            }, {
                key : {
                    concurrent : 'test4'
                },
                value : {
                    concurrent : 'test4',
                    _savedBy   : exports.savedBy
                }
            }, {
                key : {
                    prop1 : 'value1',
                    prop2 : 'value2'
                },
                value : {
                    prop1    : 'value1',
                    prop2    : 'value2',
                    _savedBy : exports.savedBy
                }
            }
        ]);
        done();
    });
};

exports.withTimeout = function(newTimeout, task, done) {
    var oldTimeout = exports.timeout;
    exports.timeout = newTimeout;
    task(function() {
        exports.timeout = oldTimeout;
        done();
    });
};

exports.testNonObjectKeys = function(done) {
    async.series([
        function(next) {
            exports.store.get('string-key', function(err, value, extra) {
                should.not.exist(err);
                value.should.equal('string-key');
                exports.generatorCalls.should.equal(1);
                extra.key.should.equal('string-key');
                extra.value.should.equal('string-key');
                next();
            });
        },

        function(next) {
            exports.store.get('string-key', function(err, value, extra) {
                should.not.exist(err);
                value.should.equal('string-key');
                exports.generatorCalls.should.equal(1);
                extra.key.should.equal('string-key');
                extra.value.should.equal('string-key');
                next();
            });
        },

        function(next) {
            exports.store.get(null, function(err, value, extra) {
                should.not.exist(err);
                should(value).equal(null);
                exports.generatorCalls.should.equal(2);
                should(extra.key).equal(null);
                should(extra.value).equal(null);
                next();
            });
        },

        function(next) {
            exports.store.get(null, function(err, value, extra) {
                should.not.exist(err);
                should(value).equal(null);
                exports.generatorCalls.should.equal(2);
                should(extra.key).equal(null);
                should(extra.value).equal(null);
                next();
            });
        },

        function(next) {
            exports.store.delete(null, function(err) {
                should.not.exist(err);
                next();
            });
        },

        function(next) {
            exports.store.delete(null, function(err) {
                should.exist(err);
                err.message.should.match(/^The specified key was not found in the/);
                next();
            });
        },

        function(next) {
            exports.store.get(true, function(err, value, extra) {
                should.not.exist(err);
                value.should.equal(true);
                exports.generatorCalls.should.equal(3);
                extra.key.should.equal(true);
                extra.value.should.equal(true);
                next();
            });
        },

        function(next) {
            exports.store.get(true, function(err, value, extra) {
                should.not.exist(err);
                value.should.equal(true);
                exports.generatorCalls.should.equal(3);
                extra.key.should.equal(true);
                extra.value.should.equal(true);
                next();
            });
        },

        function(next) {
            exports.store.get(42, function(err, value, extra) {
                should.not.exist(err);
                value.should.equal(42);
                exports.generatorCalls.should.equal(4);
                extra.key.should.equal(42);
                extra.value.should.equal(42);
                next();
            });
        },

        function(next) {
            exports.store.get(42, function(err, value, extra) {
                should.not.exist(err);
                value.should.equal(42);
                exports.generatorCalls.should.equal(4);
                extra.key.should.equal(42);
                extra.value.should.equal(42);
                next();
            });
        }
    ], done);
};
