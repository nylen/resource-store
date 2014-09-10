var fs   = require('fs'),
    path = require('path'),
    util = require('util');

exports.addTo = function(obj) {
    fs.readdirSync(__dirname).forEach(function(fn) {
        if (/\.js$/.test(fn) && fn != 'index.js') {

            // Get classname code adapted from:
            // http://blog.magnetiq.com/post/514962277
            var cls   = require('./' + fn),
                match = cls.toString().match(/function\s*(\w+)/),
                name  = match && match[1];

            if (!name) {
                throw new Error(util.format(
                    "Could not find class name of backend file '%s'.",
                    fn));
            }

            obj[name] = cls;
        }
    });
};
