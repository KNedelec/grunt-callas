
'use strict';

var Promise = require('promise');

var empty = function(){ return Promise(function (ok, ko){
    ok();
})};

function promiseIf(_if, promise){
    if(_if === true || _if()){
        return promise;
    }else{
        return empty();
    }
}

Promise.onlyIf = promiseIf;
Promise.empty = empty;

module.exports = Promise;
