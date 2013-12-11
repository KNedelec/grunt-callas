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
    spawn = require('child_process').spawn,
    webdriver = require('browserstack-webdriver'),
    fs = require('fs')
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
            device: 'iPhone5S'
        },{
            browser: 'IE',
            browser_version: '10.0',
            os: 'Windows',
            os_version: '7'
        },{
            browser: 'firefox',
            browser_version: '25.0',
            os: 'Windows',
            os_version: '8'
        }],
    });

    var _this = this;
    var done = this.async();

    Promise(function(ok, ko){

        var request = http.request({
            hostname: options.host.name,
            port: options.host.port,
            method: 'GET',
            path: '/'
        }, function(res){
            ok(res);
        });

        request.on('error', function(e){
            ko(e);
        });

        request.end();

    }).then(function(res){
        grunt.log.ok('Verification serveur http: OK');

        return Promise(function(ok, ko){
            
            var outlog = fs.openSync('./tunnel.out.log', 'a');
            var errlog = fs.openSync('./tunnel.out.log', 'a');
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

            return ok(_this.jarTunnel);
        })

    }, function(err){
        console.error(err);
        done(err);

    }).then(function(res){

        grunt.log.ok('tunnel created');

        var drivers = [];
        for ( var i = 0; i < options.browsers.length; i++) {
            var browser = options.browsers[i];

            grunt.log.ok('getting driver with browser %s on %s %s', browser.browser, browser.os, browser.os_version);

            var capability = {
                'browserstack.user': options.browserstack.user,
                'browserstack.key': options.browserstack.key,
                'browserstack.tunnel': true,
            };
            if (browser.browser) {
                capability.browser = browser.browser;
                capability.browser_version = browser.browser_version;
                capability.os = browser.os;
                capability.os_version = browser.os_version;
            }
            if (browser.device) {
                capability.device = browser.device;
            }
            var driver = new webdriver.Builder().
                usingServer('http://hub.browserstack.com/wd/hub').
                withCapabilities(capability).
                build();

            var host = util.format('http://%s:%d', options.host.name || 'localhost', options.host.port || 80 );

            drivers[i] = Promise( function( ok, ko) {
                driver.get(host).then(function(res) {
                    grunt.log.ok('then get host');
                   console.log(res);
                   return ok(res);
                }, function(err) { 
                    console.error('fail with browser %s on %s %s', host, browser.browser, browser.os, browser.os_version);
                    return ko(err);
                });
            });
            console.log(drivers);
        }

        return Promise.all(drivers).then(function (res) {
            console.log(res);
            done();
        });

    }, function(err){

        grunt.log.error('pre last then error');
        grunt.log.error(err);
        done();
    })
    .then(function (res){
        grunt.log.ok('last then success');
        grunt.log.ok(res);
    }, function (err) {
        grunt.log.ok('last then error');
        grunt.log.error(err);
    });
  });
}; 
