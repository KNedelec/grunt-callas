
'use strict'

var Promise = require('promise'),
    fs = require('fs');

var webdriver = function(context){
    this.context = context || { };
    if(!this.context.basePath){
        this.context.basePath = 'screenshots/'+ this.context.capability.browser + '/';
    }
}

var screenshot = function(name){
    var _this = this;
    return Promise(function (ok, ko){
        var fileName =  _this.context.basePath + name + '.png';
        var tempFileName = fileName;
        var diffFileName = fileName;
        fs.exists(fileName, function(exists){
            console.log('entering fs exists: ' + exists);
            if(exists){
                tempFileName = 'screenshot/' + name + '__temp.png';
                diffFileName = 'screenshot/' + name + '__diff.png';
            }   

            return _this.takeScreenshot().then(function(data){
                console.log('sc taken');
                try{
                    fs.writeFileSync(tempFileName, data, 'base64');
                } catch(e) { console.log(e);}
                if(!exists){
                    console.log('!exists');
                    return true;
                }
                console.log('fs written');

                return Promise(function (ok, ko){
                    exec('compare -metric rmse ' + fileName + ' ' + tempFileName + ' ' + diffFileName, function(err, stdout, stderr){

                        console.log('exec cb');
                        if(err){
                            grunt.log.error(err);
                            grunt.log.error(stderr);
                            return ko();
                        }
                        var regex = /\((\d+\.?\d*)\)/m;
                        //image magic output is on stderr when -metric
                        var match = regex.exec(stderr);
                        if(!match){
                            grunt.log.error('unable to parse stderr: ' + stderr);
                            return ko();
                        }
                        console.log('match: ' + match);
                        var equality = parseFloat(match[1]);
                        return ok({
                            equal: equality > 0.7,
                            equality: equality
                        });
                    });
                });
            })
            .then(function (res){
                console.log('take screenshot done : ' + res);
                return ok(res);
            }, function(err){
                return ko(err);
            });
        });
    });
};

module.exports._constructor = webdriver;
module.exports.screenshot = screenshot;
