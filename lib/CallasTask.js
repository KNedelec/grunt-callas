
function CallasTask(task){
    this.options = task.options(CallasTask.Defaults);
    this._task = task;    
}


CallasTask.prototype.run = function(){

    console.log(this.options);
    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        // Read file source.
        return grunt.file.read(filepath);
      }).join(grunt.util.normalizelf(this.options.separator));

      // Handle options.
      src += this.options.punctuation;

      // Write the destination file.
      grunt.file.write(f.dest, src);

      // Print a success message.
      grunt.log.writeln('File "' + f.dest + '" created.');
    });
}

CallasTask.Defaults = {

}

module.exports = CallasTask;
