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
Promise = require('../utils/promise'),
cprocess = require('child_process'),
Mocha = require('mocha'),
bwebdriver = require('browserstack-webdriver'),
swebdriver = require('../lib/drivers/selenium').webdriver,
events = require('events'),
fs = require('fs'),
gm = require('gm'),
UtilsObject = require('../utils/object'),
UtilsProcess = require('../utils/process')
;
var Callas = function(grunt, task){


    // Merge task-specific and/or target-specific options with these defaults.
    var options = task.options({
        screenshots:{
            disable:false
        },
        selenium:{
            port: 4444,
            outlog: 'selhub.out.log',
            errlog: 'parent'
        },
        phantomjs:{
            port: 8080,
            outlog: 'phantom.out.log',
            errlog: 'parent'
        },
        server:{
            outlog: 'wserver.out.log',
            errlog: 'parent'
        }
    });

    var _this = this;
    this.done = task.async();
    this.driversLoaded = [];
    this.prepareDrivers = prepareDrivers;

    this.run = function(){

        var server = options.server;

        var state = {
            enableImageComparison: !options.screenshots.disable,
            testFiles: options.tests.files
        }

        grunt.verbose.writeflags(state, 'state');
        Promise.all(
            !state.enableImageComparison || checkImageCompare(grunt, state),
            checkTestFiles(grunt, state),
            checkWebServer(grunt, options)
        ).then(function(res){
            //if phantom js return true
            return true;

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
            if(err){
                grunt.log.error(err);
            }
            done(err);

        }).then(function(res){

            grunt.verbose.writeln('Prepare to load drivers...');
            return _this.prepareDrivers(options, grunt)
            .then(function(drivers){
                return Promise(function(ok, ko){
                    console.log('selenium: ' + util.inspect(drivers));
                    var exec = cprocess.exec;
                    for ( var i = 0; i < drivers.length; i++) {
                        var driverType = drivers[i];
                        console.log('drivet type: ' + util.inspect(driverType));
                        grunt.verbose.ok(driverType.length + ' ' + i + ' drivers loaded');
                        for( var j = 0; j < driverType.length; j++){
                            var browser = driverType[j].browser; 

                            grunt.verbose.writeln('getting driver with browser %s on %s %s', browser.browser || browser.browserName, browser.os || 'current', browser.os_version || '');

                            console.log('browser: ' + browser);
                            var capability, driver;
                            /*if(browser.browserName === 'phantomjs'){*/
                            /*capability = browser;*/
                            /*driver = new swebdriver.Builder().*/
                            /*usingServer('http://localhost:8080').*/
                            /*withCapabilities(capability).*/
                            /*build();*/
                            /*} else {*/
                            /*capability = UtilsObject.merge( {*/
                            /*'browserstack.user': options.browserstack.user,*/
                            /*'browserstack.key': options.browserstack.key,*/
                            /*'browserstack.tunnel': true,*/
                            /*}, browser);*/
                            /*driver = new bwebdriver.Builder().*/
                            /*usingServer('http://hub.browserstack.com/wd/hub').*/
                            /*withCapabilities(capability).*/
                            /*build();*/
                            /*}*/
                            var host = util.format('http://%s:%d', options.server.name || 'localhost', options.server.port || 80 );
                            console.log('driver: ' + driver);

                            //driver.screenshot
                            drivers[i] = Promise( function( ok, ko) {
                                var _driver = driver;
                                var browserName = browser.browser;
                                _driver.get(host).then(function(res) {
                                    grunt.log.debug('driver.get.then ' + browserName);
                                    return _driver;

                                }, function(err) { 
                                    console.error('fail with browser %s on %s %s', host, browser.browser, browser.os, browser.os_version);
                                    throw(err);

                                });
                            });
                        }

                        return Promise.all(drivers).then(function (res) {
                            _this.driversLoaded = res;
                            grunt.log.debug('Promise.all ended');
                            ok();
                        }, function(err){
                            grunt.log.error('Error while preparing drivers');
                            grunt.log.error(err);
                            ko();
                        });
                    }
                });
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

    }

}

module.exports = function(grunt) {

    grunt.registerMultiTask('callas', 'Run crossbrowser functional tests based on webdriver and browserstack', function() {
        var callas = new Callas(grunt, this);
        callas.run();
    });
}; 

function prepareDrivers(options, grunt){
    var drivers = { }, promises = [];
    grunt.verbose.writeln(options.browsers.length + ' browsers configured');
    for(var i = 0; i < options.browsers.length; i++){
        var b = options.browsers[i];
        if(!drivers[b.driver]){
            drivers[b.driver] = [];
            drivers[b.driver].prepared= false;
        };

        switch(b.driver){
            case 'selenium':
                var _b = b;
                promises.push(Promise.onlyIf(!drivers[b.driver].prepared, prepareSelenium(options, grunt))
                      .then(function(res){
                              var capability = UtilsObject.merge({ }, _b);
                              delete capability.driver;
                              var driver;
                              console.log('browserName: ' + _b.browserName);
                              if(_b.browserName === 'phantomjs' || _b.browser === 'phantomjs'){
                                  preparePhantomjs(options, grunt)
                                  .then(function(res){
                                      driver = new swebdriver.Builder().
                                          usingServer('http://localhost:' + options.phantomjs.port).
                                          withCapabilities(capability).
                                          build();
                                      driver.browser = _b;
                                      drivers[b.driver].push(driver);
                                      console.log('DRIVER ADDED');
         //                             drivers[b.driver].prepared = true;
                                  });
                              }else{
                                  //selenium classic drivers
                              }


                          }));
                          break;
                          case 'browserstack':
                              break;
        }
    }

    return Promise.all(promises)
        .then(function(){
            console.log('returning prepared drivers : ' + util.inspect(drivers));
            return drivers;
        });
}

function prepareSelenium(options, grunt){

    grunt.verbose.writeln('Preparing selenium hub...');
    return UtilsProcess.runDetached(
        'java -jar ' + __dirname + '/../bin/selenium-server-standalone-2.37.0.jar -role hub -port ' + options.selenium.port,
        {
            parentExit: function(proc){
                try{
                    proc.kill();
                    grunt.verbose.log('Selenium hub killed');
                }catch(exc){
                    console.log('fail to kill selenium hub with exception ' + exc);
                }
            }
        },
        options.selenium.outlog,
        options.selenium.errlog
    ).then(function (proc){
        console.log('selenium started with handler ' + proc._handle.pid);
    }, function(err){
        grunt.log.error('Error while starting selenium hub: ' + err);
    });
}

function preparePhantomjs(options, grunt){
    console.log('preparing phantomJs');

    return UtilsProcess.runDetached(
        'phantomjs --webdriver=' + options.phantomjs.port + ' --webdriver-selenium-grid-hub=http://127.0.0.1:' + options.selenium.port,
        {
            error: function(err){ grunt.log.error('Problem with phantomjs: ' + err); },
            exit: function(exit){ grunt.log.writeln('Phantomjs hub has stopped'); },
            parentExit: function(){
                try{
                    wserver.kill();
                    grunt.verbose.log('Phantomjs hub killed');
                }catch(exc){
                    grunt.log.error('fail to kill phantomjs with exception ' + exc);
                }
            }
        },
        options.phantomjs.outlog,
        options.phantomjs.errlog
    ).then(function (proc){
        console.log('phantomjs started');
        ok();
    });

}

function checkImageCompare(grunt, state){

    if(state.enableImageComparison){
        return Promise(function(ok, ko){
            //verify we can compare screenshots
            fs.exists('/usr/bin/compare', function(exists){
                if(!exists){
                    state.enableImageComparison = false;
                    grunt.log.warn('image magick not found on the system');
                }else{
                    grunt.verbose.ok('image magick found');

                }
                return ok();
            });
        });
    }

    return true;
}

function checkTestFiles(grunt, state){
    var all = [];
    for(var i = 0; i < state.testFiles.length; i++){
        var testFile = state.testFiles[i];
        all.push(Promise(function(ok, ko){
            fs.exists(testFile, function(exists){
                if(!exists){
                    grunt.log.warn('test file ' + testFile + ' not found, removed from test queue');
                    state.testFiles.splice(i, 1);
                }else{
                    grunt.verbose.ok('test file ' +  testFile + ' found');

                }
                return ok();
            });
        }));
    }

    return Promise.all(all);
}

function checkWebServer(grunt, options){

    return Promise(function (ok, ko){

        var request = http.request({
            hostname: options.server.name,
            port: options.server.port,
            method: 'GET',
            path: '/'
        }, function(res){
            grunt.log.ok('web server already launched, listening on ' + options.server.name + ':' + options.server.port + ' [http ' + res.statusCode + ']');
            ok(res);
        });

        request.on('error', function(e){
            if(options.server.startCommand){
                UtilsProcess.runDetached(
                    options.server.startCommand,
                    {
                        error: function(err){ grunt.log.error('Web server error: ' + err); },
                        exit: function(exit){ grunt.log.writeln('web server has stopped'); },
                        parentExit: function(){
                            try{
                                wserver.kill();
                                grunt.verbose.log('web server killed');
                            }catch(exc){
                                grunt.log.error('fail to kill web server with exception ' + exc);
                            }
                        }
                    },
                    options.server.outlog,
                    options.server.errlog
                ).then(function (proc){
                    console.log(util.inspect(proc));
                    ok();
                });;
            }else{
                grunt.log.error('Nothing is listening on ' + options.server.name + ':' + options.server.port + '. Please launch your web server or configure server.startCommand');
                ko();
            }
        });

        request.end();
    });
}
