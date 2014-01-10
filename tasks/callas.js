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
bwebdriver = require('../lib/drivers/browserstack').webdriver,
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
            disable:false,
            compare: true,
            baseDir: 'screenshots'
        },
        selenium:{
            port: 4444,
            outlog: 'selhub.out.log',
            errlog: 'stderr'
        },
        browserstack:{
            outlog: 'tunnel.out.log',
            errlog: 'stderr'
        },
        phantomjs:{
            port: 8080,
            outlog: 'phantom.out.log',
            errlog: 'stderr'
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

        grunt.verbose.subhead('Checking application params...');

        Promise.all(
            options.screenshots.disable || prepareScreenshots(grunt, options),
            !options.screenshots.compare  || checkImageCompare(grunt, options),
            checkTestFiles(grunt, options),
            checkWebServer(grunt, options)

        ).then(function(res){

            if(options.browserstack && options.browserstack.requireTunneling){
                grunt.verbose.subhead('Preparing drivers...');
                return prepareBrowserstack(options, grunt);
            }
            return true;

        }, function(err){
            if(err){ grunt.log.error(err); }
            done(err);

        }).then(function(res){

            grunt.log.ok('Application parameters: OK');
            grunt.verbose.subhead('Preparing drivers...');

            return _this.prepareDrivers(options, grunt)
                .then(function(){

                grunt.verbose.ok(_this.driversLoaded[0] + ' drivers successfully prepared');
                grunt.verbose.ok('driversLoaded: ' + util.inspect(_this.driversLoaded));

                return Promise(function(ok, ko){
                    var exec = cprocess.exec;
                    for (var driverType in _this.driversLoaded) {
                        if(!_this.driversLoaded.hasOwnProperty(driverType)){
                            continue;
                        }
                        if(!_this.driversLoaded[driverType].drivers.length){
                            console.log('driver type ' + driverType + ' has 0 drivers loaded, its tests are canceled');
                            continue;
                        }
                        var driversLoaded = _this.driversLoaded[driverType].drivers;
                        var promises = [];

                        for( var j = 0; j < driversLoaded.length; j++){
                            var driver = driversLoaded[j];
                            var browser = driversLoaded[j].browser; 

                            grunt.verbose.writeln('getting driver with browser %s on %s %s', browser.browser || browser.browserName, browser.os || 'current', browser.os_version || '');

                            console.log('browser: ' + browser);
                            var capability;
                            var host = util.format('http://%s:%d', options.server.name || 'localhost', options.server.port || 80 );

                            promises.push(Promise( function( ok, ko) {
                                var _driver = driver;
                                var browserName = browser.browser;
                                console.log('host: ' + util.inspect(host));
                                _driver.get(host).then(function(res) {
                                    grunt.log.debug('driver.get.then ' + res);
                                    _driver.context.host = host;
                                    ok(_driver);

                                }, function(err) {
                                    console.error('fail with browser %s on %s %s', host, browser.browser, browser.os, browser.os_version);
                                    throw(err);

                                });;
                            }));
                        }

                        return Promise.all(promises).then(function (res) {
                            grunt.log.debug('Promise.all ended');
                            ok(res);
                        }, function(err){
                            grunt.log.error('Error while preparing drivers');
                            grunt.log.error(err);
                            ko();
                        });
                    }
                });
            });

        }, function(err){
            grunt.log.error(err);
            done();

        })
        .then(function (res){
            grunt.log.ok('browsers launched');

            var testPromises = [];

            var ind = 0;
            for(var driverType in _this.driversLoaded){
                if(!_this.driversLoaded.hasOwnProperty(driverType) ||
                   !_this.driversLoaded[driverType].drivers.length){
                    continue;
                }
                for(var di = 0; di < _this.driversLoaded[driverType].drivers.length; di++){
                    testPromises[++ind] = Promise(function(ok, ko) {
                        var driver = _this.driversLoaded[driverType].drivers[di];

                        var mocha = new Mocha;

                        for (var tf = 0; tf < options.tests.files.length; tf++) {
                            var file = options.tests.files[tf];
                            mocha.addFile(file);
                        }

                        mocha.suite.on('post-require', function(){
                            driver.id = di;
                            process.emit('driverReady', driver);
                        });
                        try{
                            var runner = mocha.run( function() {
                                console.log('test finished');
                                ok(runner);
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
            }

            return Promise.all(testPromises).then(function (){
                grunt.log.ok('all test promises ended');
            }, function(err){
                grunt.log.error('error with mocha' + util.inspect(err));
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

function prepareScreenshots(grunt, options){
    return Promise(function(ok, ko){
        if(options.screenshots && options.screenshots.baseDir) {
            fs.exists(options.screenshots.baseDir, function(exists){
                if(!exists){
                    fs.mkdir(options.screenshots.baseDir);
                }
                ok();
            });

        }else{
            throw('No screenshots baseDir configuration');
        }
    });
}

function prepareDrivers(options, grunt){

    var _this = this;
    var drivers = this.driversLoaded, promises = [];
    grunt.verbose.writeln(options.browsers.length + ' drivers to configure..');

    for(var i = 0; i < options.browsers.length; i++){
        var b = options.browsers[i];
        if(!drivers[b.driver]){
            drivers[b.driver] = { };
            drivers[b.driver].drivers = [];
            drivers[b.driver].prepared= false;
        };

        switch(b.driver){
            case 'selenium':
                (function(_b){
                    grunt.verbose.writeflags(_b, 'Browser');

                    promises.push(Promise.onlyIf(!drivers[b.driver].prepared, prepareSelenium(options, grunt))
                      .then(function(res){
                          var capability = UtilsObject.merge({ }, _b);
                          delete capability.driver;
                          var driver;

                          if(_b.browserName === 'phantomjs' || _b.browser === 'phantomjs'){
                              return preparePhantomjs(options, grunt)
                              .then(function(res){
                                  return Promise(function(ok, ko){
                                      driver = new swebdriver.Builder().
                                          usingServer('http://localhost:' + options.phantomjs.port).
                                          withCapabilities(capability).
                                          build();
                                      driver.manage().timeouts().implicitlyWait(30000);
                                      driver.setContext({ capability: capability, screenshotDir: options.screenshots.baseDir});
                                      driver.browser = _b;
                                      drivers[_b.driver].drivers.push(driver);
                                      grunt.verbose.ok('Driver for phantomjs added');
                                      ok();
                                  });
                                  drivers[_b.driver].prepared = true;
                              });
                          }else{
                              return true;
                              //selenium classic drivers
                          }
                      }))
                })(b);
            break;
            case 'browserstack':
                var _b = b;
                promises.push(Promise(function(ok,ko){
                    grunt.verbose.writeflags(_b, 'Browser');
                    var capability = UtilsObject.merge( {
                          'browserstack.debug': true,
                          'browserstack.user': options.browserstack.user,
                          'browserstack.key': options.browserstack.key,
                          'browserstack.tunnel': options.browserstack.requireTunneling
                    }, _b);
                    delete capability.driver;
                    var driver = new bwebdriver.Builder().
                        usingServer('http://hub.browserstack.com/wd/hub').
                        withCapabilities(capability).
                        build();
                    driver.manage().timeouts().implicitlyWait(30000);
                    driver.setContext({capability: capability, screenshotDir: options.screenshots.baseDir });
                    driver.browser = _b;
                    drivers[_b.driver].drivers.push(driver);
                    grunt.verbose.ok('Driver for browserstack added');
                    ok();
                  })
                );
              break;
        }
    }

    return Promise.all(promises)
        .then(function(){
            grunt.log.writeflags(_this.driversLoaded);
            return drivers;
        }, function(err){
            if(err){ grunt.log.error(err); }
        }
    );
}


function prepareBrowserstack(options, grunt){
    return UtilsProcess.runDetached(
        'java -jar ' + __dirname + '/../bin/BrowserStackTunnel.jar '+ options.browserstack.key + ' ' +  options.server.name + ',' + options.server.port + ',0',
        {
            parentExit: function(proc){
                try{
                    proc.kill();
                    grunt.verbose.log('Browserstack tunnel killed');
                }catch(exc){
                    console.log('fail to kill browserstack with exception ' + exc);
                }
            }
        },
        options.browserstack.outlog,
        options.browserstack.errlog
    ).then(function (proc){
        console.log('Browserstack tunnel started with handler ' + proc.pid);
    }, function(err){
        grunt.log.error('Error while starting browserstack tunnel ' + err);
    });
};
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
        return proc;
    });

}

function checkImageCompare(grunt, options){

    if(options.screenshots.compare){
        return Promise(function(ok, ko){
            //verify we can compare screenshots
            fs.exists('/usr/bin/compare', function(exists){
                if(!exists){
                    options.screenshots.compare = false;
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

function checkTestFiles(grunt, options){
    var files = options.tests.files;
    var all = [];
    for(var i = 0; i < files.length; i++){
        var testFile = files[i];
        all.push(Promise(function(ok, ko){
            fs.exists(testFile, function(exists){
                if(!exists){
                    grunt.log.warn('test file ' + testFile + ' not found, removed from test queue');
                    options.tests.files.splice(i, 1);
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
