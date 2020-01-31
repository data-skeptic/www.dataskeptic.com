const AWS = require('aws-sdk');
const cache = require('memory-cache-ttl');
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

var s3 = new AWS.S3({region: 'us-west-2'});

cache.init({ ttl: 60 * 60 * 3, interval: 1, randomize: false });

const bucket_name = "serverless-crawl";

var app = express();

//var redirectToHTTPS = require('express-http-to-https').redirectToHTTPS

const root = 'user/test/apps/publishingtools/outbox/data-skeptic/blog/master/'

// Don't redirect if the hostname is `localhost:port` or the route is `/insecure`
//app.use(redirectToHTTPS([/localhost:(\d{4})/], [/\/insecure/], 301));

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
        "ts": 1580054950,
        "key": "episodes/2020/fooling-computer-vision",
        "slug": "fooling-computer-vision",
        "title": "Fooling Computer Vision",
        "abstract": "Wiebe van Ranst joins us to talk about a project in which specially designed printed images can fool a computer vision system, preventing it from identifying a person.  Their attack targets the popular YOLO2 pre-trained image recognition model, and thus, is likely to be widely applicable.",
        "author": "",
        "guid": "d3a15282-a7e5-428b-8153-9b9caff3a463",
        "mp3_url": "https://traffic.libsyn.com/secure/dataskeptic/fooling-computer-vision.mp3",
        "duration": 1525
    }
    res.render('pages/index', {episode: lastest_episode})
})


app.get('/login', (req, res) => res.render('pages/login'))


async function get_episodes(path) {
    const prefix = `${root}${path}`
    var getParams = {
        Bucket: bucket_name,
        Prefix: prefix
    }
    let data;
    if (cache.check(prefix)) {
        data = cache.get(prefix)
    } else {
        try {
            data = await s3.listObjects(getParams).promise();
            cache.set(prefix, data);
        } catch (err) {
            console.log(err)
            res.render('pages/error')
            return [];
        }
    }
    const result = []
    const episodeList = data.Contents;
    for (const episode of episodeList) {
        const key = episode.Key
        const x = '.episode.json'
        if (key.endsWith(x)) {
            var getParams2 = {
                Bucket: bucket_name,
                Key: episode.Key
            }
            let data2;
            if (cache.check(episode.Key)) {
                data2 = cache.get(episode.Key)
            } else {
                try {
                    data2 = await s3.getObject(getParams2).promise();
                    cache.set(episode.Key, data2);
                } catch (err) {
                    console.log(err);
                }
            }
            if (data2) {
                const ebody = data2.Body.toString('utf-8');
                const ep = JSON.parse(ebody);
                const k = episode.Key
                const i = k.indexOf(path);
                ep['path'] = k.substring(i, k.length - x.length);
                result.push(ep);
            };
        }
    }
    function compare( a, b ) {
      if ( a.ts < b.ts ){
        return -1;
      }
      if ( a.ts > b.ts ){
        return 1;
      }
      return 0;
    }
    result.sort( compare );
    return result;
}

app.get('/advertising', async (req, res) => {
    res.render('pages/advertising');
});

app.get('/podcasts', async (req, res) => {
    const title = "Data Skeptic: Interpretability";
    const episodes = await get_episodes('episodes/2020/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/nlp', async (req, res) => {
    const title = "Data Skeptic: Natural Language Processing";
    const episodes = await get_episodes('episodes/2019/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/ai', async (req, res) => {
    const title = "Data Skeptic: Artificial Intelligence";
    const _episodes = await get_episodes('episodes/2018/');
    const episodes = []
    for (const ep of _episodes) {
        if (ep.album_cover.indexOf("fake-news-album") == -1) {
            episodes.push(ep);
        }
    }
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/fakenews', async (req, res) => {
    const title = "Data Skeptic: Fake News";
    const _episodes = await get_episodes('episodes/2018/');
    const episodes = []
    for (const ep of _episodes) {
        if (ep.album_cover.indexOf("fake-news-album") != -1) {
            episodes.push(ep);
        }
    }
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/2017', async (req, res) => {
    const title = "Data Skeptic: 2017";
    const episodes = await get_episodes('episodes/2017/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/2016', async (req, res) => {
    const title = "Data Skeptic: 2016";
    const episodes = await get_episodes('episodes/2016/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/2015', async (req, res) => {
    const title = "Data Skeptic: 2015";
    const episodes = await get_episodes('episodes/2015/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/2014', async (req, res) => {
    const title = "Data Skeptic: 2014";
    const episodes = await get_episodes('episodes/2014/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/blog/*', function(req, res) {
    var key = req.path;
    if(key.indexOf(".html") === -1) {
        key = key + ".html";
    }
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
    var episode = undefined
    s3.getObject(getParams, function(err, data) {
        if (err) {
            console.log(err)
            res.render('pages/error')
            return err;
        }
        let body = data.Body.toString('utf-8');
        s3.getObject(getParams2, function(err, data) {
            if (err) {
                res.render('pages/blog', {body, episode})
            } else {
                const ebody = data.Body.toString('utf-8');
                episode = JSON.parse(ebody);
                res.render('pages/blog', {body, episode})
            }
        });
    });

});

// TODO: create a honeypot for /wp/wp-admin/ requests

app.get('*', (req, res) => res.send('Page Not found 404'));

app.listen(PORT, () => console.log(`Listening on ${ PORT }`))

