/*
 * grunt-allas
 * https://github.com/kevin/grunt-callas
 *
 * Copyright (c) 2013 Kevin Nedelec
 * Licensed under the MIT license.
 */

'use strict';

var http = require('http'),
    util = require('util'),
    Promise = require('promise'),
    cprocess = require('child_process'),
    Mocha = require('mocha'),
    webdriver = require('browserstack-webdriver'),
    events = require('events'),
    fs = require('fs'),
    gm = require('gm')
;

module.exports = function(grunt) {
    
    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('callas', 'Run crossbrowser functional tests based on webdriver and browserstack', function() {
        // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
            host: {
                name: 'localhost',
                port: 9000,
                requireTunneling: true
            },
            browserstack: {
                user: 'kevinnedelec',
                key: 'SzVD7GpwyvVExoLvnq3y'
            },
            browsers: [{
                platform: 'MAC',
                browserName: 'iPhone',
                version: '6.0'
            },
            /*{*/
            /*browser: 'IE',*/
            /*browser_version: '10.0',*/
            /*os: 'Windows',*/
            /*os_version: '7'*/
            /*},*/
            {
                browser: 'firefox',
                browser_version: '25.0',
                os: 'Windows',
                os_version: '8',
                resolution: '1920x1200'
            }
            ],
            tests: {
                files: ['./firsttestremote.js'],
                outputDir: 'output'
            }
        });

        var _this = this;
        var done = this.async();
        this.driversLoaded = [];

        Promise(function(ok, ko){
            
            // system verifications
            fs.exists('/usr/bin/compare', function(exists){
                if(!exists){
                    grunt.log.warn('image magick not found on the system');
                }
                return ok();
            });
        }).then(function (){
            return Promise(function (ok, ko){

                var request = http.request({
                    hostname: options.host.name,
                    port: options.host.port,
                    method: 'GET',
                    path: '/'
                }, function(res){
                    return ok(res);
                });

                request.on('error', function(e){
                    return ko(e);
                });

                request.end();
            });

        }).then(function(res){
            grunt.log.ok('Verification serveur http: OK');

            return Promise(function(ok, ko){

                var outlog = fs.openSync('./tunnel.out.log', 'a');
                var errlog = fs.openSync('./tunnel.out.log', 'a');
                var spawn = cprocess.spawn;
                _this.jarTunnel = spawn('java', ['-jar', 'bin/BrowserStackTunnel.jar', options.browserstack.key, options.host.name + ',' + options.host.port + ',0'], { detached: true, stdio: ['ignore', outlog, errlog] });
                _this.jarTunnel.unref();
                _this.jarTunnel.on('error', function(err){
                    grunt.log.error('BrowserStackTunnel a PLANTE');
                    throw(err);
                });

                _this.jarTunnel.on('exit', function(exit){
                    grunt.log.error('Browserstacl tunnel has stopped');
                    console.error(exit);
                    throw(exit);
                });

                process.on('exit', function(){
                    _this.jarTunnel.kill();
                });

                setTimeout(function (){
                    //wait for tunneling to be created
                    return ok(_this.jarTunnel);
                }, 5000);
            })

        }, function(err){
            console.error(err);
            done(err);

        }).then(function(res){

            var drivers = [];
            var exec = cprocess.exec;
            for ( var i = 0; i < options.browsers.length; i++) {
                var browser = options.browsers[i];

                grunt.log.ok('getting driver with browser %s on %s %s', browser.browser, browser.os, browser.os_version);

                var capability = merge( {
                    'browserstack.user': options.browserstack.user,
                    'browserstack.key': options.browserstack.key,
                    'browserstack.tunnel': true,
                }, browser);
                var driver = new webdriver.Builder().
                    usingServer('http://hub.browserstack.com/wd/hub').
                    withCapabilities(capability).
                    build();

                var host = util.format('http://%s:%d', options.host.name || 'localhost', options.host.port || 80 );

                driver.screenshot = function(name){
                    var _this = this;
                    return Promise(function (ok, ko){
                        var fileName =  'screenshot/' + name + '_' + _this.id + '.png';
                        var tempFileName = fileName;
                        var diffFileName = fileName;
                        fs.exists(fileName, function(exists){
                            console.log('entering fs exists: ' + exists);
                            if(exists){
                                tempFileName = 'screenshot/' + name + '_' + _this.id + '__temp.png';
                                diffFileName = 'screenshot/' + name + '_' + _this.id + '__diff.png';
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
                                        var equality = parseFloat(match(1));
                                        ok({
                                            equal: equality > 0.7,
                                            equality: equality
                                        });
                                    });
                                });
                            })
                            .then(function (res){
                                console.log('take screenshot done : ' + res);
                                ok(res);
                            }, function(err){
                                ko(err);
                            });
                        });
                    });
                };
                drivers[i] = Promise( function( ok, ko) {
                    var _driver = driver;
                    var browserName = browser.browser;
                    _driver.get(host).then(function(res) {
                        grunt.log.debug('driver.get.then ' + browserName);
                        return ok(_driver);

                    }, function(err) { 
                        console.error('fail with browser %s on %s %s', host, browser.browser, browser.os, browser.os_version);
                        return ko(err);

                    });
                });
            }
            
            return Promise.all(drivers).then(function (res) {
                _this.driversLoaded = res;
                grunt.log.debug('Promise.all ended');
            });

        }, function(err){
            grunt.log.error('Error while creating tunnel');
            grunt.log.error(err);
            done();

        })
        .then(function (res){
            grunt.log.ok('browsers launched');

            var testPromises = [];
            for (var di = 0; di < _this.driversLoaded.length; di++) {
                var _di = di;
                testPromises[di] = Promise(function(ok, ko) {
                    var driver = _this.driversLoaded[di];
                    var mocha = new Mocha;

                    for (var tf = 0; tf < options.tests.files.length; tf++) {
                        var file = options.tests.files[tf];
                        mocha.addFile(file);
                    }

                    mocha.suite.on('post-require', function(){
                        driver.id = _di;
                        process.emit('driverReady', driver);
                    });
                    try{
                        var runner = mocha.run( function() {
                            console.log('test finished');
                            return ok();
                        });
                    } catch(e) {
                        console.log(e);
                        grunt.log.error(e);
                        return ko();
                    }
                    runner.on('pass', function(test) {
                        console.log('... %s passed', test.title);
                    });
                    runner.on('fail', function(test) {
                        console.log('... %s failed', test.title);
                    });
                });
            }

            return Promise.all(testPromises).then(function (){
                grunt.log.ok('all test promises ended');
            });
        }, function (err) {
            grunt.log.ok('last then error');
            grunt.log.error(err);
            done();

        })
        .then(function (res){
            console.log('last then');
            done();
        });;
    });
}; 

function merge(obj1, obj2){
    var obj3 = { };
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
