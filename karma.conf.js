module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      'src/test.ts',
      'src/**/*.spec.ts'
    ],
    preprocessors: {
      'src/test.ts': ['webpack']
    },
    webpack: require('./webpack.config.js'),
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Brave'],
    customLaunchers: {
      Brave: {
        base: 'Chrome',
        flags: ['--no-sandbox'],
        executablePath: process.env.CHROME_BIN // Uses the environment variable set above
      }
    },
    singleRun: false,
    restartOnFileChange: true
  });
};
