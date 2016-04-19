/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

var UglifyJS = require('uglify-js');
var babel = require('gulp-babel');
var browserify = require('browserify');
var bundleCollapser = require('bundle-collapser/plugin');
var del = require('del');
var derequire = require('derequire/plugin');
var envify = require('envify');
var flatten = require('gulp-flatten');
var fs = require('fs');
var gulp = require('gulp');
var gutil = require('gulp-util');
var path = require('path');
var source = require('vinyl-source-buffer');
var spawn = require('child_process').spawn;
var through = require('through2');
var unreachableBranchTransform = require('unreachable-branch-transform');

var packageJson = require('./package.json');

var babelPluginModules = require('fbjs-scripts/babel-6/rewrite-modules');

var SIMPLE_TEMPLATE =
  fs.readFileSync('./grunt/data/header-template-short.txt', 'utf8');

var LICENSE_TEMPLATE =
  fs.readFileSync('./grunt/data/header-template-extended.txt', 'utf8');

var paths = {
  react: {
    src: [
      'src/**/*.js',
      '!src/**/__tests__/**/*.js',
      '!src/**/__mocks__/**/*.js',
      '!src/shared/vendor/**/*.js',
    ],
    lib: 'build/modules',
  },
};

var babelOpts = {
  plugins: [
    [babelPluginModules, {
      map: Object.assign(
        {},
        require('fbjs/module-map'),
        {
          'object-assign': 'object-assign',
        }
      ),
    }],
  ],
};

gulp.task('browserify:basic', ['react:modules'], function() {
  var b = browserify({
    entries: [path.join(__dirname, 'build/modules/React.js')],
    debug: false,
    detectGlobals: false,
    standalone: 'React',
    packageFilter: function(pkg, dir) {
      // Ensure all dependencies get built with this NODE_ENV
      pkg.browserify = {transform: [[envify, {NODE_ENV:'development'}]]};
      return pkg;
    },
  });
  b.plugin(bundleCollapser);
  b.plugin(derequire);

  var banner = through();
  banner.push(new Buffer(
    SIMPLE_TEMPLATE
      .replace('<%= package %>', 'React')
      .replace('<%= version %>', packageJson.version)
  ));

  return b.bundle()
    .pipe(banner)
    .pipe(source('react.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('browserify:min', ['react:modules'], function() {
  var b = browserify({
    entries: [path.join(__dirname, 'build/modules/React.js')],
    debug: false,
    detectGlobals: false,
    standalone: 'React',
    packageFilter: function(pkg, dir) {
      // Ensure all dependencies get built with this NODE_ENV
      pkg.browserify = {transform: [[envify, {NODE_ENV:'production'}]]};
      return pkg;
    },
  });
  b.transform(unreachableBranchTransform);
  b.plugin(bundleCollapser);
  b.plugin(packReduce(function(src) {
    return UglifyJS.minify(src, {fromString: true}).code;
  }));

  var banner = through();
  banner.push(new Buffer(
    LICENSE_TEMPLATE
      .replace('<%= package %>', 'React')
      .replace('<%= version %>', packageJson.version)
  ));

  return b.bundle()
    .pipe(banner)
    .pipe(source('react.min.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('browserify:addons', ['react:modules'], function() {
  var b = browserify({
    entries: [path.join(__dirname, 'build/modules/ReactWithAddons.js')],
    debug: false,
    detectGlobals: false,
    standalone: 'React',
    packageFilter: function(pkg, dir) {
      // Ensure all dependencies get built with this NODE_ENV
      pkg.browserify = {transform: [[envify, {NODE_ENV:'development'}]]};
      return pkg;
    },
  });
  b.plugin(bundleCollapser);
  b.plugin(derequire);

  var banner = through();
  banner.push(new Buffer(
    SIMPLE_TEMPLATE
      .replace('<%= package %>', 'React (with addons)')
      .replace('<%= version %>', packageJson.version)
  ));

  return b.bundle()
    .pipe(banner)
    .pipe(source('react-with-addons.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('browserify:addonsMin', ['react:modules'], function() {
  var b = browserify({
    entries: [path.join(__dirname, 'build/modules/ReactWithAddons.js')],
    debug: false,
    detectGlobals: false,
    standalone: 'React',
    packageFilter: function(pkg, dir) {
      // Ensure all dependencies get built with this NODE_ENV
      pkg.browserify = {transform: [[envify, {NODE_ENV:'development'}]]};
      return pkg;
    },
  });
  b.transform(unreachableBranchTransform);
  b.plugin(bundleCollapser);
  b.plugin(packReduce(function(src) {
    return UglifyJS.minify(src, {fromString: true}).code;
  }));

  var banner = through();
  banner.push(new Buffer(
    LICENSE_TEMPLATE
      .replace('<%= package %>', 'React (with addons)')
      .replace('<%= version %>', packageJson.version)
  ));

  return b.bundle()
    .pipe(banner)
    .pipe(source('react-with-addons.min.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('browserify', [
  'browserify:basic',
  'browserify:min',
  'browserify:addons',
  'browserify:addonsMin',
]);

gulp.task('build-modules', ['react:modules']);
gulp.task('delete-build-modules', ['react:clean']);

gulp.task('build:basic', ['version-check', 'browserify:basic']);
gulp.task('build:addons', ['browserify:addons']);
gulp.task('build:min', ['version-check', 'browserify:min']);
gulp.task('build:addons-min', ['version-check', 'browserify:addonsMin']);

gulp.task('build:react-dom', function() {
  var header = LICENSE_TEMPLATE
    .replace('<%= package %>', 'ReactDOM')
    .replace('<%= version %>', packageJson.version);
  var src = fs.readFileSync('vendor/react-dom.js', 'utf8');

  var dist = new gutil.File({
    path: 'react-dom.js',
    contents: new Buffer(header + src),
  });

  var min = new gutil.File({
    path: 'react-dom.min.js',
    contents: new Buffer(header + UglifyJS.minify(src, {fromString: true}).code),
  });

  var out = through.obj();
  out.push(dist);
  out.push(min);

  return out.pipe(gulp.dest('build'));
});

gulp.task('version-check', function(done) {
  var failed = false;
  var versions = {
    'packages/react/package.json':
      require('./packages/react/package.json').version,
    'packages/react-dom/package.json':
      require('./packages/react-dom/package.json').version,
    'packages/react-addons/package.json (version)':
      require('./packages/react-addons/package.json').version,
    'packages/react-addons/package.json (react dependency)':
      // Get the "version" without the range bit
      require('./packages/react-addons/package.json').peerDependencies.react.slice(1),
    'src/ReactVersion.js':
      require('./src/ReactVersion'),
  };
  Object.keys(versions).forEach(function(name) {
    if (versions[name] !== packageJson.version) {
      failed = true;
      gutil.log(
        '%s version does not match package.json. Expected %s, saw %s.',
        name,
        packageJson.version,
        versions[name]
      );
    }
  });
  if (failed) {
    process.exit(1);
  }
  done();
});

gulp.task('eslint', function(cb) {
  var extension = process.platform === 'win32' ? '.cmd': '';
  spawn(
    process.execPath,
    [path.join('node_modules', '.bin', 'eslint' + extension), '.'],
    {stdio: 'inherit'}
  ).on('close', function(code) {
    if (code === 0) {
      gutil.log('Lint passed');
      cb();
    } else {
      gutil.log('Lint failed');
      process.exit(code);
    }
  });
});

gulp.task('lint', ['eslint']);

gulp.task('react:clean', function() {
  return del([paths.react.lib]);
});

gulp.task('react:modules', function() {
  return gulp
    .src(paths.react.src)
    .pipe(babel(babelOpts))
    .pipe(flatten())
    .pipe(gulp.dest(paths.react.lib));
});

gulp.task('jest', function(cb) {
  spawn(
    process.execPath,
    ['--harmony', path.join('node_modules', '.bin', 'jest')],
    {stdio: 'inherit', env: {NODE_ENV: 'test'}}
  ).on('close', function(code) {
    if (code === 0) {
      gutil.log('jest passed');
      cb();
    } else {
      gutil.log('jest failed');
      process.exit(code);
    }
  });
});

gulp.task('test', ['jest']);

gulp.task('default', ['react:modules']);

function packReduce(fn) {
  return function(b) {
    var chunks = [];
    b.pipeline.get('pack').push(through(function(chunk, enc, next) {
      chunks.push(chunk);
      next();
    }, function(next) {
      var src = String(Buffer.concat(chunks));
      this.push(fn(src));
      next();
    }));
  };
}
