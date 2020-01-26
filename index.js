const AWS = require('aws-sdk');
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

var s3 = new AWS.S3({region: 'us-west-2'});

const bucket_name = "serverless-crawl";

var app = express();

var redirectToHTTPS = require('express-http-to-https').redirectToHTTPS

// Don't redirect if the hostname is `localhost:port` or the route is `/insecure`
app.use(redirectToHTTPS([/localhost:(\d{4})/], [/\/insecure/], 301));

app.use(express.static(path.join(__dirname, 'public')))

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get('feed.rss', (req, res) => res.redirect(301, 'http://dataskeptic.libsyn.com/rss'))

app.get('/', (req, res) => res.render('pages/index'))
app.get('/podcasts', (req, res) => res.render('pages/podcasts'))

app.get('/insecure', function (req, res) {
  res.send('Dangerous!');
});

app.get('/blog/*', function(req, res) {
    var key = req.path;
    if(key.indexOf(".html") === -1) {
        key = key + ".html";
    }
    const root = 'user/test/apps/publishingtools/outbox/data-skeptic/blog/master/'
    key = root + key.substring(6, key.length)
    console.log(key)
    var getParams = {
        Bucket: bucket_name,
        Key: key
    }
    s3.getObject(getParams, function(err, data) {
        if (err)
            return err;
        let body = data.Body.toString('utf-8');
        res.render('pages/blog', {body})
    });

});

app.get('*', (req, res) => res.send('Page Not found 404'));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`))

