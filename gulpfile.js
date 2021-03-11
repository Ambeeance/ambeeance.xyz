const gulp = require('gulp');
const clean = require('gulp-clean');
const csso = require('gulp-csso')
const util = {
    colors: require('ansi-colors'),
    log: require('fancy-log'),
};
const { src, dest, parallel, series, watch } = gulp;
const cheerio = require('gulp-cheerio');
const postcss = require('gulp-postcss');
const uncss = require('postcss-uncss');
const tailwindcss = require('tailwindcss')();
const autoprefixer = require('autoprefixer');
const serveStatic = require('serve-static');
const connect = require('connect');
const livereloadInjector = require('connect-livereload');
const livereloadTinyLR = require('tiny-lr');
const open = require('open');
const fs = require('fs');
const path = require('path');

const PORT_SERVER = process.env.PORT || 5000;
const PORT_LIVERELOAD = 35729;
const livereloadServer = livereloadTinyLR();
const middlewareLiveReload = livereloadInjector();
const middlewareStatic = serveStatic('dist');

function notifyLivereload(event) {
    const filename = path.relative('dist', event);
    util.log(`Reloading: ${filename}`)
    livereloadServer.changed({
        body: {
            files: [filename]
        }
    });
    return util.noop();
}

gulp.task('livereload', function(cb) {
    livereloadServer.listen(PORT_LIVERELOAD)
    cb();
});

gulp.task('server', series('livereload', function(cb) {
    const server = connect();
    server.use(middlewareLiveReload)
        .use(middlewareStatic)
        .use(function (req, res, next) {
            util.log(util.colors.green(req.url));
            next();
        })
        .listen(PORT_SERVER, () => {
            util.log(`Listening: ${util.colors.cyan(PORT_SERVER)}`)
            open(`http://localhost:${PORT_SERVER}`);
            cb();
        })
}));

const getSvg = (id) => {
    return fs.readFileSync(path.join(__dirname, `node_modules/heroicons/solid/${id}.svg`)).toString();
}

gulp.task('clean', function() {
    return src('dist/*', {read: false}).pipe(clean())
})

gulp.task('copy:assets', function() {
    return src('src/assets/*').pipe(dest('dist/assets/'))
});

gulp.task('copy', series('copy:assets'))

gulp.task('css', function() {
    const plugins = [tailwindcss, autoprefixer(), uncss({
        html: ['src/*.html']
    })]
    return src('src/tailwind.css')
        .pipe(postcss(plugins))
        .pipe(csso({
            html: ['src/*.html']
        }))
        .pipe(dest('./dist/'));
});

gulp.task('html', () => {
    return src('src/*.html')
        .pipe(cheerio(($, file, done) => {
            $('.icon').each(function () {
                const icon = $(this);
                const data = icon.attr('data-heroicon')
                if (data) {
                    let svg = getSvg(data);
                    const replace = $(svg)
                    replace.attr('class', icon.attr('class'));
                    icon.replaceWith(replace);
                }
            });
            done();
        }))
        .pipe(dest('dist/'));
});

gulp.task('build', parallel('html', 'css', 'copy'));

gulp.task('watch:html', function() {
    gulp.watch('src/*.html').on('change', series('html'))
})

gulp.task('watch:dist', function() {
    gulp.watch('dist/*').on('change', notifyLivereload);
})

gulp.task('watch', series('server', parallel('watch:html', function() {
    gulp.watch('src/*.css').on('change', series('css'))
    gulp.watch('src/assets/*').on('change', series('copy:assets'))
}, 'watch:dist')));

gulp.task('default', series('build'));