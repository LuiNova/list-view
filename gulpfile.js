var gulp = require('gulp'),
    sourcemaps = require('gulp-sourcemaps'),
    babel = require('gulp-babel'),
    sass = require('gulp-ruby-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    cssnano = require('gulp-cssnano'),
    eslint = require('gulp-eslint'),
    uglify = require('gulp-uglify'),
    imagemin = require('gulp-imagemin'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    cache = require('gulp-cache'),
    livereload = require('gulp-livereload'),
    browserSync = require('browser-sync').create(),
    del = require('del');

var paths = {
    src: {
        js: 'src/javascript/**/*.js',
        sass: 'src/sass/**/*.scss',
        sassIndex: 'src/sass/main.scss',
    },
    output: {
        root: 'dist/',
        css: 'dist/assets/css/',
        js: 'dist/assets/js/'
    }
};

gulp.task('styles', function() {
    return sass('src/sass/main.scss', { style: 'expanded'})
        // .pipe(autoprefixer('last 2 version'))
        .pipe(autoprefixer({browsers: ['last 2 version'] , remove: false}))
        .pipe(gulp.dest('dist/assets/css'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(cssnano())
        .pipe(gulp.dest('dist/assets/css'))

        //.pipe(browserSync.stream())

        .pipe(notify({ message: 'Style task complete' }));
});

gulp.task('fonts', function() {
    return gulp.src('src/fonts/**/*')
        .pipe(gulp.dest('dist/assets/fonts'));
});

gulp.task('lib', function() {
    return gulp.src('src/lib/**/*')
        .pipe(gulp.dest('dist/lib'));
});

gulp.task('lib-js', function() {
    return gulp.src('src/lib/**/*.js')
        .pipe(concat('deps.js'))
        .pipe(gulp.dest('dist/lib'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(uglify())
        .pipe(gulp.dest('dist/lib'))
        .pipe(notify({ message: 'JS libs task complete' }));
});

gulp.task('scripts', function() {
    // return gulp.src('src/javascript/**/*.js')
    return gulp.src(['app.js', 'src/javascript/**/*.js'])
        // .pipe(eslint())
        // .pipe(eslint.format())
        // .pipe(eslint.failAfterError())
        .pipe(sourcemaps.init())
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(concat('main.js'))
        // .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/assets/js'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/assets/js'))
        .pipe(notify({ message: 'Scripts task complete' }));
});

gulp.task('images', function() {
    return gulp.src('src/images/**/*')
        .pipe(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true })) // 5 - caching
        .pipe(gulp.dest('dist/assets/img'))
        .pipe(notify({ message: 'Images task complete' }));
});

gulp.task('clean', function() {
    return del(['dist/assets/css', 'dist/assets/js', 'dist/assets/img', 'dist/assets/fonts', 'dist/lib']);
});

gulp.task('default', ['clean'], function() {
    gulp.start('fonts', 'styles', 'lib', 'lib-js', 'scripts', 'images');
});

gulp.task('watch', function() {

    // Watch font files
    gulp.watch('src/fonts/**/*', ['fonts']);

    // Watch .scss files
    gulp.watch('src/sass/**/*.scss', ['styles']);

    // Watch .js files
    gulp.watch('src/javascript/**/*.js', ['scripts']);

    // Watch image files
    gulp.watch('src/images/**/*', ['images']);

    // Create LiveReload server
    livereload.listen();

    // Watch any files in dist/, reload on change
    gulp.watch(['dist/**']).on('change', livereload.changed);
});

// Static Server + watching scss/html files
gulp.task('serve', ['lib', 'lib-js', 'styles', 'scripts', 'images'], function() {

    browserSync.init({
        server: './'
    });

    gulp.watch('src/lib/**/*', ['lib', browserSync.reload]);
    gulp.watch('src/lib/**/*.js', ['lib-js', browserSync.reload]);

    gulp.watch('src/sass/**/*.scss', ['styles', browserSync.reload]);
    gulp.watch('src/javascript/**/*.js', ['scripts', browserSync.reload]);
    gulp.watch('src/images/**/*', ['images', browserSync.reload]);
    gulp.watch('*.html').on('change', browserSync.reload);
    gulp.watch('*/*.html').on('change', browserSync.reload);
});

gulp.task('dev', ['serve']);
