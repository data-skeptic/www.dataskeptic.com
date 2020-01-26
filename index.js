const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

var app = express();

var redirectToHTTPS = require('express-http-to-https').redirectToHTTPS

// Don't redirect if the hostname is `localhost:port` or the route is `/insecure`
app.use(redirectToHTTPS([/localhost:(\d{4})/], [/\/insecure/], 301));

app.use(express.static(path.join(__dirname, 'public')))

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get('/', (req, res) => res.render('pages/index'))

app.get('/insecure', function (req, res) {
  res.send('Dangerous!');
});

app.listen(PORT, () => console.log(`Listening on ${ PORT }`))

