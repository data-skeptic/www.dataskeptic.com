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

app.get('/feed.rss', (req, res) => res.redirect(301, 'http://dataskeptic.libsyn.com/rss'))

app.get('/', (req, res) => {
    lastest_episode = {
        "ts":1580054950,
        "title": "Fooling Computer Vision",
        "abstract": "Wiebe van Ranst joins us to talk about a project in which specially designed printed images can fool a computer vision system, preventing it from identifying a person.  Their attack targets the popular YOLO2 pre-trained image recognition model, and thus, is likely to be widely applicable.",
        "author": "",
        "guid": "d3a15282-a7e5-428b-8153-9b9caff3a463",
        "mp3_url": "https://traffic.libsyn.com/secure/dataskeptic/fooling-computer-vision.mp3",
        "duration":1525
    }
    res.render('pages/index', {episode: lastest_episode})
})


app.get('/login', (req, res) => res.render('pages/login'))

app.get('/podcasts', (req, res) => {
    const episodes = [
        {
            "ts":1580054950,
            "title": "Fooling Computer Vision",
            "abstract": "Wiebe van Ranst joins us to talk about a project in which specially designed printed images can fool a computer vision system, preventing it from identifying a person.  Their attack targets the popular YOLO2 pre-trained image recognition model, and thus, is likely to be widely applicable.",
            "author": "",
            "guid": "d3a15282-a7e5-428b-8153-9b9caff3a463",
            "mp3_url": "https://traffic.libsyn.com/secure/dataskeptic/fooling-computer-vision.mp3",
            "duration":1525
        }
    ];
    res.render('pages/podcasts', {episodes});
});

app.get('/blog/*', function(req, res) {
    var key = req.path;
    if(key.indexOf(".html") === -1) {
        key = key + ".html";
    }
    const root = 'user/test/apps/publishingtools/outbox/data-skeptic/blog/master/'
    key = root + key.substring(6, key.length)
    const metadata_key = key.substring(0, key.length - 5) + ".episode.json"
    var getParams = {
        Bucket: bucket_name,
        Key: key
    }
    var getParams2 = {
        Bucket: bucket_name,
        Key: metadata_key
    }
    s3.getObject(getParams, function(err, data) {
        if (err) {
            console.log(err)
            res.render('pages/error')
            return err;
        }
        let body = data.Body.toString('utf-8');
        s3.getObject(getParams2, function(err, data) {
            if (err) {
                res.render('pages/blog', {body})
            } else {
                const ebody = data.Body.toString('utf-8');
                const episode = JSON.parse(ebody);
                res.render('pages/blog', {body, episode})
            }
        });
    });

});

// TODO: create a honeypot for /wp/wp-admin/ requests

app.get('*', (req, res) => res.send('Page Not found 404'));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`))

