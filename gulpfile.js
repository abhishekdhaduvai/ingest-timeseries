'use strict';
const gulp = require('gulp');
const plugins = require('gulp-load-plugins')();
const gulpSequence = require('gulp-sequence');


var dev = process.argv.indexOf('--dist') < 0;

// -----------------------------------------------------------------------------
// getTask() loads external gulp task script functions by filename
// -----------------------------------------------------------------------------
function getTask(task) {
	return require('./tasks/' + task)(gulp, plugins);
}

// -----------------------------------------------------------------------------
// Task: Compile : Scripts, Sass, EJS, All
// -----------------------------------------------------------------------------
gulp.task('compile:sass', getTask('compile.sass'));
gulp.task('compile:index', ['compile:sass'], getTask('compile.index'));

// -----------------------------------------------------------------------------
// Task: Serve : Start
// -----------------------------------------------------------------------------
gulp.task('serve:dev:start', getTask('serve.dev.start'));
gulp.task('serve:dist:start', ['dist'], getTask('serve.dist.start'));

// -----------------------------------------------------------------------------
// Task: Watch : Source, Public, All
// -----------------------------------------------------------------------------
gulp.task('watch:public', getTask('watch.public'));

// -----------------------------------------------------------------------------
// Task: Dist (Build app ready for deployment)
// 	clean, compile:sass, compile:index, copy, bundle
// -----------------------------------------------------------------------------
gulp.task('dist', ['dist:copy']);

// -----------------------------------------------------------------------------
// Task: Dist : Copy source files for deploy to dist/
// -----------------------------------------------------------------------------
gulp.task('dist:copy', ['dist:clean', 'compile:index'], getTask('dist.copy'));

// -----------------------------------------------------------------------------
// Task: Dist : Clean 'dist/'' folder
// -----------------------------------------------------------------------------
gulp.task('dist:clean', getTask('dist.clean'));

// -----------------------------------------------------------------------------
//  Task: Default (compile source, start server, watch for changes)
// -----------------------------------------------------------------------------
gulp.task('default', function (cb) {
	gulpSequence('compile:index', (dev ? 'serve:dev:start' : 'serve:dist:start'), 'watch:public')(cb);
});

// var gulp = require('gulp'),
// 	uglify = require('gulp-uglify'),
// 	plumber = require('gulp-plumber'),
// 	browsersync = require('browser-sync'),
// 	reload = browsersync.reload,
// 	autoprefixer = require('gulp-autoprefixer'),
// 	rename = require('gulp-rename');

// //Scripts

// gulp.task('scripts', function(){
// 	gulp.src(['public/scripts/**/*.js','!public/scripts/**/*.min.js'])
// 		.pipe(plumber())
// 		.pipe(rename({suffix:'.min'}))
// 		.pipe(uglify())
// 		.pipe(gulp.dest('public/scripts'))
// 		.pipe(reload({stream:true}));
// });

// //html
// gulp.task('html', function(){
// 	gulp.src('public/**/*.html')
// 		.pipe(reload({stream:true}));
// });

// //browsersync
// gulp.task('browser-sync', function(){
// 	browsersync({
// 		server:{
// 			baseDir: "./public/"
// 		}
// 	})
// })

// //watch
// gulp.task('watch', function(){
// 	gulp.watch('public/scripts/**/*.js', ['scripts']);
// 	gulp.watch('public/**/*.html',['html']);
// });

// //default
// gulp.task('default',['scripts','html','browser-sync','watch']);