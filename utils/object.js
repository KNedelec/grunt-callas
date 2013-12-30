'use strict';

module.exports = {
    merge: function(obj1, obj2){
        var obj3 = {};
        for(var attr in obj1){
            if(obj1.hasOwnProperty(attr)){
                obj3[attr] = obj1[attr];
            }
        }
        for(var attr in obj2){
            if(obj2.hasOwnProperty(attr)){
                obj3[attr] = obj2[attr];
            }
        }
        return obj3;
    }
}
