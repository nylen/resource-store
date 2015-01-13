# resource-store [![Build status](https://img.shields.io/travis/nylen/resource-store.svg?style=flat)](https://travis-ci.org/nylen/resource-store) [![npm package](http://img.shields.io/npm/v/resource-store.svg?style=flat)](https://www.npmjs.org/package/resource-store)

`resource-store` is a Node.js caching/memoization library with multiple storage
backends.

## Usage

Create a `ResourceStore` object with a generator callback.  Then, request
values from it by calling the `get` method and passing JavaScript objects or
primitives as keys.  If the given key is not already cached, the generator
function will be called to generate its value.

The generator function receives keys and generates the values associated with
them.  For a given key, the value it returns should always be the same.

The optional `backend` argument determines the type of storage used by the store:

- **Omitted** - In-memory storage only, using `MemoryBackend`.
- **String** - File-backed storage starting at the given directory, using
  `FileBackend`.
- **Object** - An object with methods `get`, `set`, `delete`, and `list`, see
  [Backends](#backends) below for details.

The `extra` parameter passed to the generator function is an object that can be
used to store extra data alongside the value generated from the key.  See
[Out-of-Band Data](#out-of-band-data) below for more information.

```js
var ResourceStore = require('resource-store');

var store = new ResoureStore(backend, function generator(key, extra, cb) {
    var value;
    // generate value based on key
    // generator callback takes parameters (err, value)
    cb(null, value);
});
```

## Methods

### get(key, cb)

Retrieves a value from the store.  If the value for the given key has not been
generated yet, the generator function will be called, otherwise the stored
value will be returned.  If multiple calls are made to `get` for the given key,
then the generator function will only be called once and all outstanding calls
will return when the generator completes.

The callback to `get` takes parameters (`err`, `value`, `extra`):

- `err` - `null` unless an error occurred in the generator function or the
  storage backend.
- `value` - the value associated with the requested key.
- `extra` - see [Out-of-Band Data](#out-of-band-data) below.

```js
store.get({ prop1 : 'value1' }, function(err, value, extra) {
    // do stuff with the returned value
});
```

### delete(key, cb)

Deletes a value from the store.  If the value specified by `key` does not exist
then an error will be returned.

```js
store.delete({ prop1 : 'value1' }, function(err) {
    // delete succeeded if err is null
});
```

### list(cbEntry, cbDone)

Lists all values cached in the store.

`cbEntry` is called once for each entry with parameters `err`, `key`, `value`,
`extra`.  See [Out-of-Band Data](#out-of-band-data) below for more information
about the `extra` parameter.

`cbDone` is called after all entries have been listed with parameters `err`,
`numEntries`.

```js
store.list(function cbEntry(err, key, value, extra) {
    // do something with this value
}, function cbDone(err, numEntries) {
    // now go do something else
});
```

## Out-of-Band Data

Some callback functions receive an `extra` parameter which is the actual value
sent to the storage backend (the value associated with the given key is stored
at `extra.value`).  The generator function can set properties on `extra` to
store data alongside the cached value.  This can be useful for debugging.

The library will also set the following values on `extra` (all date/time values
are millisecond-precision Unix timestamps, the result of `+new Date`):

- `key` - the key object associated with this item.  Not very useful to
  consumers, but needed because a backend may not know its own keys.
- `value` - the data value associated with this key.
- `createStarted` - available for all functions, but most useful in `get` and
  `list`.
- `createEnded` - set when the generator function completes; available for
  `get` and `list`.
- `lastRetrieved` - set when a value is generated or retrieved from the storage
  backend.  Available in `get` and `list`, but most useful in `list` to allow
  deleting old data.
- `wasCached` - available in `get` and set to `true` if the requested value was
  already cached (i.e. the generator function *was not* called).
- `baseFilename` - available in all functions if using the `FileBackend` for
  storage.  This is the data filename where the value will be stored, without
  the `.json` extension.  This is useful for storing additional binary data
  alongside the key.

## Backends

Storage backends that can be used by this library must store data objects
associated with string keys.  **Note**: `ResourceStore` accepts object keys,
but storage backends accept string keys.

Backends must implement the following methods:

- `get` - return the value associated with a key, and set and remember
  `value.lastRetrieved`, or return `false` if nothing is stored with that key.
- `set` - set the data value associated with a key.
- `delete` - clear the data value associated with a key.
- `list` - list all data values stored.

Backends can have a `shouldCache` property.  If it is missing or truthy, then
`ResourceStore` will remember values retrieved from the backend when multiple
calls to `get` are made concurrently for the same key.  Set
`backend.shouldCache = false` to disable this behavior if retrieving data from
the backend is effectively instantaneous.

Pseudocode (to avoid
[http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony](releasing Zalgo),
all of these methods should be asynchronous in real implementations):

```js
// cb takes parameters (err, value)
backend.get = function(keyString, cb) {
    // If the key doesn't have anything stored, return false
    if (!(keyString in backend.data)) {
        return cb(null, false);
    }
    // Get the data value associated with the key
    var value = ...;
    // Set lastRetrieved (and persist it somehow)
    value.lastRetrieved = +new Date;
    // err is null unless getting the value failed
    cb(err, value);
};

// cb takes parameters (err)
backend.set = function(keyString, value, cb) {
    // Set the data value associated with the key
    backend.data[keyString] = value;
    // err is null unless setting the value failed
    cb(err);
};

// cb takes parameters (err)
backend.delete = function(keyString, cb) {
    // Clear the data value associated with the key
    // err is null unless deleting the value failed
    cb(err);
};

// cbEntry takes parameters (err, key, value)
// cbDone  takes parameters (err, numEntries)
backend.list = function(cbEntry, cbDone) {
    // Get the list of keys stored
    var keys = Object.keys(backend.data),
        numEntries = 0;
    // Loop and return values
    keys.forEach(function(k) {
        var value = backend.data[k];
        // Skip values that were removed after obtaining the list of keys
        if (typeof value != 'undefined') {
            // Passing the key is optional:  some backends (like FileBackend)
            // don't know their own keys, so pass null instead
            // Set value.lastRetrieved if it isn't already set
            value.lastRetrieved = backend.lastRetrieved[k];
            cbEntry(null, k, value);
            numEntries++;
        }
    });
    cbDone(null, numEntries);
};
```

Except for the `list` method, backends do not need to worry about concurrency:
`ResourceStore` will serialize operations for a given key so that only one of
`get`, `set`, and `delete` is operating at a time.  The `list` method should
store a list of keys first, then loop over them and skip keys that no longer
have associated data values.

The library comes with two backends already implemented:
`ResourceStore.FileBackend` and `ResourceStore.MemoryBackend`.

`new FileBackend(dir)` stores data in JSON filenames named based on the hash of
the requested keys, starting at the directory `dir` and creating subdirectories
as needed.

`new MemoryBackend()` stores data in memory in a plain old JavaScript object.
