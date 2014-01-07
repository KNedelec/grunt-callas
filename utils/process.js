
'use strict';

var cprocess = require('child_process'),
    Promise = require('promise'),
    fs = require('fs');

module.exports = {
    runDetached: function(command, listeners, outlog, errlog,  args){
        if(!args){
            var parsedCmd = this.parseCommand(command);
            command = parsedCmd.cmd;
            args = parsedCmd.args;
        }

        var fsopen = Promise.denodeify(fs.open);
        var promiseOut = 'stdout' === outlog ? Promise.empty() : fsopen(outlog, 'w');
        var promiseErr = 'stderr' === errlog ? Promise.empty() : fsopen(errlog, 'w');
        return Promise.all(
            promiseOut,
            promiseErr
        ).then(function(files){
            return Promise(function(ok, ko){
                var proc = cprocess.spawn(command, args, { detached: true, stdio: ['ignore', files[0], 'stderr' === errlog ? process.stderr : files[1]]});

                if(listeners.parentExit){
                    process.on('exit', function(){ listeners.parentExit(proc); });
                }else{
                    process.on('exit', proc.kill());
                }

                proc.unref();

                console.log('proc.unref');

                setTimeout(function(){
                    ok(proc);
                }, 4000);
            });
        });
    },

    parseCommand: function(command){
        if(!command){
            throw Error('cannot parse empty command');
        }
        var splitCmd = command.split(' ');
        var returnCmd = {
            cmd: splitCmd[0],
            args: []
        };
        if(splitCmd.length > 0){
            returnCmd.args = splitCmd.slice(1, splitCmd.length );
        }

        return returnCmd;
    }
}
