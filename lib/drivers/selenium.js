
'use strict'

var swebdriver = require('selenium-webdriver'),
    util = require('util'),
    Driver = require('./driver');

var webdriver = Driver._constructor;
//var baseConstructor = swebdriver.WebDriver;
console.log('Driver.constructor: '+ util.inspect(swebdriver));
util.inherits(webdriver, swebdriver.WebDriver);

webdriver.prototype.screenshot = Driver.screenshot;
swebdriver.WebDriver = webdriver;

module.exports.webdriver = swebdriver;
