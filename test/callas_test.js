'use strict';

var assert = require('assert'),
    UtilsProcess = require('../utils/process');


describe('utils-process-tests', function(){
    describe('The command parser', function(){
        var noargsCmd = 'grunt',
            argsCmd = 'grunt server --production',
            empty = '',
            _undefined = undefined;

        it('must parse a command without arguments', function(){
           assert.equal(noargsCmd, UtilsProcess.parseCommand(noargsCmd).cmd);
           assert.equal([].length, UtilsProcess.parseCommand(noargsCmd).args.length);

        });

        it('must parse a command with arguments and fill args array', function(){

           assert.equal('grunt', UtilsProcess.parseCommand(argsCmd).cmd);
           assert.equal(2, UtilsProcess.parseCommand(argsCmd).args.length);
           assert.equal('server', UtilsProcess.parseCommand(argsCmd).args[0]);
           assert.equal('--production', UtilsProcess.parseCommand(argsCmd).args[1]);

        });

        it('must throw exception if command is empty or unedefined', function(){

           assert.throws(function(){ UtilsProcess.parseCommand(empty); }, Error);
           assert.throws(function(){ UtilsProcess.parseCommand(_undefined); },Error);
        });
    });
});
