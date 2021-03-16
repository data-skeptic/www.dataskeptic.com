const AWS = require('aws-sdk');
const cache = require('memory-cache-ttl');
const express = require('express')
const path = require('path')
const redirects = require('./redirects.js').redirects
const PORT = process.env.PORT || 5000
const showdown  = require('showdown')

var s3 = new AWS.S3({region: 'us-east-1'});
var dynamo = new AWS.DynamoDB({region: 'us-east-1'});

cache.init({ ttl: 60 * 60 * 3, interval: 1, randomize: false });

const bucket_name = "feaas-prod";

var app = express();

//var redirectToHTTPS = require('express-http-to-https').redirectToHTTPS

const root = 'user/kyle@dataskeptic.com/dataskeptic/pub/blog/'

// Don't redirect if the hostname is `localhost:port` or the route is `/insecure`
//app.use(redirectToHTTPS([/localhost:(\d{4})/], [/\/insecure/], 307));


app.use(express.static(path.join(__dirname, 'public')))

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get('/download', (req, res) => res.redirect(301, req.query.q))

app.get('/feed.rss', (req, res) => res.redirect(307, 'http://dataskeptic.libsyn.com/rss'))

app.get('/survey', (req, res) => res.redirect(307, 'https://docs.google.com/forms/d/e/1FAIpQLSc7SbmG04zJFxrDsMH0uIm1geqKwDSJ6P3gq3oGl_9T251Pww/viewform'))

app.get('/meetup', (req, res) => res.redirect(307, 'https://www.meetup.com/Data-Skeptic/'))

app.get('/live', (req, res) => res.redirect(307, 'https://www.youtube.com/watch?v=4cFAH1Eji2U'))

app.get('/consulting', async function(req, res) {
    res.render('pages/consulting');
    // var getParams = {
    //     Bucket: "dataskeptic.com",
    //     Key: "consult.html"
    // }
    // s3.getObject(getParams, function(err, data) {
    //     res.send(data.Body.toString('utf-8'));
    // });
})

app.get('/consulting2', async function(req, res) {
    res.render('pages/consulting2');
    // var getParams = {
    //     Bucket: "dataskeptic.com",
    //     Key: "consult2.html"
    // }
    // s3.getObject(getParams, function(err, data) {
    //     res.send(data.Body.toString('utf-8'));
    // });
})

app.get(['/lp', '/lp*'], async function(req, res) {
    let url = req.originalUrl.substring(3, req.originalUrl.length)
    if (url.indexOf('/', 1) == -1) {
        url += '/'
    }
    if (url.endsWith('/')) {
        url += 'index.html'
    }
    var getParams = {
        Bucket: "dataskeptic.com",
        Key: "lp" + url
    }
    s3.getObject(getParams, function(err, data) {
        if (err) {
            console.log(err)
            res.render('pages/error')
            return err;            
        }
        res.send(data.Body.toString('utf-8'));
    });
})

app.get('/shopify', async (req, res) => {
    res.render('pages/shopify');
});

app.post('/flush', async function(req, res) {
    cache.flush();
    res.redirect(307, '/')
})

app.get('/', async function(req, res) {
    const episode = await get_s3_json_data(`${root}latest-episode.json`);
    const guests = []
    if (episode['guests']) {
        for (const guest_id of episode['guests']) {
            const object_id = "kyle@dataskeptic.com/stream.com.dataskeptic.blog.guest." + guest_id
            guest = await get_dynamo_object(object_id)
            guests.push(guest)
        }
    }
    console.log(JSON.stringify(guests))
    const blogdata = await get_s3_json_data(`${root}latest-blogs.json`, []);
    const blogs = blogdata['blogs'];
    for (const blog of blogs) {
        const date = new Date(blog['timestamp'])
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hour = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();
        month = (month < 10 ? "0" : "") + month;
        day = (day < 10 ? "0" : "") + day;
        hour = (hour < 10 ? "0" : "") + hour;
        min = (min < 10 ? "0" : "") + min;
        sec = (sec < 10 ? "0" : "") + sec;
        var str = date.getFullYear() + "-" + month + "-" + day;
        blog['dt'] = str;
        if (blog['public_url'] == undefined) {
            blog['public_url'] = blog['link'];
        }
        public_url = blog['public_url'];
        if (public_url) {
            if (public_url.startsWith("http://dataskeptic.com")) {
                blog['public_url'] = public_url.substring(22);
            }
            if (public_url.startsWith("https://dataskeptic.com")) {
                blog['public_url'] = public_url.substring(23);
            }            
        }
        if (blog['body']) {
            var converter = new showdown.Converter()
            blog['body'] = converter.makeHtml(blog['body'])

        }
    }
    var metadata = {}
    res.render('pages/index', {metadata, episode, blogs, guests})
})


app.get('/login', (req, res) => res.render('pages/login'))


async function get_dynamo_object(object_id) {
    var params = {
        TableName: 'feaas-docstore-prod',
        Key: { 'object_id': {'S': object_id }}
    }
    try{
        data = await dynamo.getItem(params).promise()
        const result = {}
        if (data['Item']) {
            for (const k of Object.keys(data['Item'])) {
                const db_v = data['Item'][k]
                const v = Object.values(db_v)[0]
                result[k] = v
            }
        }
        return result
    } catch (err) {
        console.log(err)
    }
    return undefined;
}

async function get_stream(timestamp) {
    const stream_id = "kyle@dataskeptic.com/stream.com.dataskeptic.blog"
    var params = {
        TableName: 'feaas-feeds-prod',
        Key: { 
            'stream_id': {'S': stream_id },
            'timestamp': {'N': timestamp }
        }
    }
    try{
        data = await dynamo.getItem(params).promise()
        const result = {}
        if (data['Item']) {
            for (const k of Object.keys(data['Item'])) {
                const db_v = data['Item'][k]
                const v = Object.values(db_v)[0]
                result[k] = v
            }
        }
        return result
    } catch (err) {
        console.log(err)
    }
    return undefined;
}

async function get_s3_json_data(key, null_val=null) {
    var getParams = {
        Bucket: bucket_name,
        Key: key
    }
    let data;
    if (cache.check(key)) {
        data = cache.get(key)
    } else {
        try {
            data = await s3.getObject(getParams).promise();
            cache.set(key, data);
        } catch (err) {
            console.log(err);
        }
    }
    if (data === undefined) {
        console.log(`No key named ${key} in ${bucket_name}`)
        return null_val;
    }
    const s = data.Body.toString('utf-8');
    return JSON.parse(s);
}


async function get_s3_ls_data(path) {
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
    return data.Contents
}

async function get_episodes(path) {
    const data = await get_s3_ls_data(path);
    const result = []
    const episodeList = data;
    for (const episode of episodeList) {
        const key = episode.Key
        const x = '.episode.json'
        if (key.endsWith(x)) {
            const jdata = await get_s3_json_data(key);
            if (jdata) {
                const i = key.indexOf(path);
                jdata['path'] = key.substring(i, key.length - x.length);
                result.push(jdata);
            };
        }
    }
    function compare( a, b ) {
      if ( a.ts < b.ts ){
        return 1;
      }
      if ( a.ts > b.ts ){
        return -1;
      }
      return 0;
    }
    result.sort( compare );
    return result;
}

app.get('/advertising', async (req, res) => {
    res.render('pages/advertising');
});

app.get('/careers/sales-engineer', async (req, res) => {
    res.render('pages/careers/sales-engineer');
});

app.get('/careers', async (req, res) => {
    res.render('pages/careers');
});

app.get('/donate', async (req, res) => {
    res.render('pages/donate');
});

app.get('/privacy-policy', async (req, res) => {
    res.render('pages/privacy-policy');
});

app.get('/podcasts/dataskeptic', async (req, res) => {
    const title = "Data Skeptic";
    const episodes = await get_episodes('episodes/2020/');
    res.render('pages/podcasts', {title, episodes});
});

app.get('/podcasts/jclub', async (req, res) => {
    const title = "Data Skeptic: Journal Club";
    const episodes = await get_episodes('journalclub/2020/');
    res.render('pages/jc/jclub', {title, episodes});
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

app.get('/blog/*', async function(req, res) {
    var key = req.path;
    const url = `https://dataskeptic.com/blog/${key.substring(6, key.length)}`
    console.log({url})
    var doc = await get_dynamo_object(url)
    var metadata = {}
    if (doc && doc['timestamp']) {
        metadata = await get_stream(doc['timestamp'])
    } else {
        console.log({nodoc: doc})
        metadata = undefined
    }
    var guests = []
    if (metadata['guests']) {
        for (var guest_o of metadata['guests']) {
            var guest_s = guest_o['S']
            var g = await get_dynamo_object('kyle@dataskeptic.com/stream.com.dataskeptic.blog.guest.heidi-howard')
            guests.push(g)
        }
    }
    if(key.indexOf(".html") === -1) {
        key = key + ".html";
    }
    key = root + key.substring(6, key.length)
    var getParams = {
        Bucket: bucket_name,
        Key: key
    }
    var transcript = {"sentences": []}
    if (metadata && metadata['timeline_key']) {
        // # TODO: load it to pass in
        var data = await s3.getObject({Bucket: bucket_name, Key: metadata['timeline_key']}).promise();
        transcript = JSON.parse(data.Body.toString('utf-8'));
    }
    s3.getObject(getParams, function(err, data) {
        if (err) {
            console.log(err)
            console.log({key})
            res.render('pages/error')
            return err;
        }
        let body = data.Body.toString('utf-8');
        res.render('pages/blog', {body, metadata, transcript, guests})
    });

});

// TODO: create a honeypot for /wp/wp-admin/ requests

app.get('/ads.txt', (req, res) =>
    res.send('google.com, pub-9618988589932555, DIRECT, f08c47fec0942fa0')
);

app.get('*', async function(req, res) {
    var key = req.path;
    var val = redirects[key]
    if (val !== undefined) {
        console.log(`Redirect ${key} to ${val}`)
        res.redirect(307, val)
    } else {
        res.send('Page Not found 404')        
    }

});

app.listen(PORT, () => console.log(`Listening on ${ PORT }`))

