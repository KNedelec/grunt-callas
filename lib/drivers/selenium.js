
'use strict'

var swebdriver = require('selenium-webdriver'),
    util = require('util'),
    Driver = require('./driver');

var webdriver = Driver._constructor;
util.inherits(webdriver, swebdriver.WebDriver);

webdriver.prototype.screenshot = Driver.screenshot;

module.exports.webdriver = webdriver;
