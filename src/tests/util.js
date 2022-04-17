

/*
// based on: http://adripofjavascript.com/blog/drips/object-equality-in-javascript.html and https://stackoverflow.com/a/16788517
function isEquivalent(a, b) {
    // check for non-object types
    if ( a === null || b === null || a === undefined || b === undefined ) {
        return a === b;
    }
    // Create arrays of property names
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);
    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
        return false;
    }
    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];
        // If values of same property are not equal,
        // objects are not equivalent.
        if (a[propName] !== b[propName]) {
            //return false; // check for nested objects
            if (! isEquivalent(a[propName], b[propName])) {
                return false;
            }
        }
    }
    // If we made it this far, objects
    // are considered equivalent
    return true;
}*/
// source: https://stackoverflow.com/a/16788517
function objectEquals(x, y) {
    'use strict';

    if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
    // after this just checking type of one would be enough
    if (x.constructor !== y.constructor) { return false; }
    // if they are functions, they should exactly refer to same one (because of closures)
    if (x instanceof Function) { return x === y; }
    // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
    if (x instanceof RegExp) { return x === y; }
    if (x === y || x.valueOf() === y.valueOf()) { return true; }
    if (Array.isArray(x) && x.length !== y.length) { return false; }

    // if they are dates, they must had equal valueOf
    if (x instanceof Date) { return false; }

    // if they are strictly equal, they both need to be object at least
    if (!(x instanceof Object)) { return false; }
    if (!(y instanceof Object)) { return false; }

    // recursive object equality check
    var p = Object.keys(x);
    return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) &&
        p.every(function (i) { return objectEquals(x[i], y[i]); });
}


/*
function assertEquals(a, b) {
    test = (a == b);
    if (!test) {
        console.error(a+" doesn't equals "+ b + "!!");
        return false;
    }
    return true;
}*/
