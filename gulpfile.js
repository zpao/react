/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

var babel = require('gulp-babel');
var del = require('del');
var flatten = require('gulp-flatten');
var gulp = require('gulp');
var gutil = require('gulp-util');
var path = require('path');
var spawn = require('child_process').spawn;

var babelPluginModules = require('fbjs-scripts/babel-6/rewrite-modules');

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
