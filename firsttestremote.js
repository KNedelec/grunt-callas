var fs = require('fs'),
    assert = require('assert'),
    util = require('util'),
    Mocha = require('mocha'),
    webdriver = require('browserstack-webdriver');
    //test = require('selenium-webdriver/testing');


console.log('init mocha file');

process.on('driverReady', function(_driver){


    console.log('driver ready ' + _driver.id);
    var driver = _driver;
    try {
    describe('test describe', function(){
        this.timeout(0);
        try {
            it('should be always true', function(done){
                assert.equal(true, true);
                done();
            });

        } catch (e) { console.log(e);}
    });

    describe('test the class attribute', function(){
        this.timeout(0);
        it('should be dgp_pushTrigger', function(done){

            try{
                var button = driver.findElement(webdriver.By.id('button1'));
                return button.getAttribute('class')
                .then(function(value){
                    assert.equal(value, 'dgp_pushTrigger');

                    return driver.screenshot('index')
                    .then(function(res){
                        console.log(res);
                        console.log('equality: ' + res.equality);
                        assert.ok(res.equal, 'images are different');
                        return done();
                    }, function(err){
                        console.log('ERROR while taking screenshot');
                        return done();
                    });
                });
            }catch(e){
                console.error('something append with the driver');
                console.error(e);
                done();
            }
        });
    });
    } catch(e) {
        console.log(e);
    }
});


/*promise.then(function(){*/
/*console.log('promise.then');*/
/*describe('test describe', function(){*/
/*it('should be always true', function(){*/
/*assert.equal(true, true);*/
/*console.log('manual assert');*/
/*});*/
/*});*/

/*console.log('driver: ' + util.inspect(driver));*/
/*});*/
/*var itest = function(){*/
/*console.log('entering testfile..');*/
/*this.run = function(driver, name){*/

/*var mocha = new Mocha;*/
/*console.log(util.inspect(mocha));*/
/**//*test.describe('button has the good class', function(){*/
/**//*test.it('should be the same', function(){*/
/**//*var button = driver.findElement(webdriver.By.id('button1'));*/
/**//*button.getAttribute('class')*/
/**//*.then(function(value){*/
/**//*assert.equal(value, 'dgp_pushTrigger');*/
/**//*});*/
/**//*});*/
/**//*});*/

/*driver.takeScreenshot().then(function(data){*/
/*fs.writeFileSync('screenshot1_remote' + name + '.png', data, 'base64');*/

/*});*/

/**//*var data = driver.takeScreenshot();*/
/**//*console.log(data);*/
/**//*fs.writeFileSync('screenshot1_remote' + name + '.png', data, 'base64');*/

/*driver.close();driver.quit();*/
/*}*/
/*};*/
/*module.exports = itest;*/
