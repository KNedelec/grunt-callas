
'use strict'

var swebdriver = require('browserstack-webdriver'),
    util = require('util'),
    Driver = require('./driver');

    var webdriver = function(context){
        swebdriver.WebDriver.call(this);
        this.context = context || { };
        if(!this.context.basePath){
            this.context.basePath = 'screenshots/'+ this.context.capability.browser + '/';
        }
    }

/*webdriver.prototype.screenshot = Driver.screenshot;*/
/*swebdriver.WebDriver = webdriver;*/
swebdriver.WebDriver.prototype.setContext = function(context){

        this.context = context || { };
        if(!this.context.basePath){
            this.context.basePath = 'screenshots/'+ this.context.capability.browser || this.context.capability.browserName + '/';
        }
};
swebdriver.WebDriver.prototype.screenshot = Driver.screenshot;

module.exports.webdriver = swebdriver;
