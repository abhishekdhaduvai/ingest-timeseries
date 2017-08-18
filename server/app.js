
var http = require('http'); 
var express = require('express');
var jsonServer = require('json-server'); 
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport;
var session = require('express-session');
var proxy = require('./routes/proxy'); 
var config = require('./predix-config');
var passportConfig = require('./passport-config');
var userInfo = require('./routes/user-info');
var app = express();
var httpServer = http.createServer(app);
var WebSocket = require('ws');

app.set('trust proxy', 1);

// if running locally, we need to set up the proxy from local config file:
var node_env = process.env.node_env || 'development';
console.log('************ Environment: '+node_env+'******************');

if (node_env === 'development') {
  var devConfig = require('./localConfig.json')[node_env];
	proxy.setServiceConfig(config.buildVcapObjectFromLocalConfig(devConfig));
	proxy.setUaaConfig(devConfig);
} else {
  app.use(require('compression')()) // gzip compression
}

// Session Storage Configuration:
// *** Use this in-memory session store for development only. Use redis for prod. **
var sessionOptions = {
  secret: 'predixsample',
  name: 'cookie_name', // give a custom name for your cookie here
  maxAge: 30 * 60 * 1000,  // expire token after 30 min.
  proxy: true,
  resave: true,
  saveUninitialized: true
  // cookie: {secure: true} // secure cookie is preferred, but not possible in some clouds.
};
var redisCreds = config.getRedisCredentials();
if (redisCreds) {
  console.log('Using Redis for session store.');
  var RedisStore = require('connect-redis')(session);
  sessionOptions.store = new RedisStore({
    host: redisCreds.host,
    port: redisCreds.port,
    pass: redisCreds.password,
    ttl: 1800 // seconds = 30 min
  });
}
app.use(cookieParser('predixsample'));
app.use(session(sessionOptions));

console.log('UAA is configured?', config.isUaaConfigured());
if (config.isUaaConfigured()) {
	passport = passportConfig.configurePassportStrategy(config);
  app.use(passport.initialize());
  // Also use passport.session() middleware, to support persistent login sessions (recommended).
  app.use(passport.session());
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

/****************************************************************************
	SET UP EXPRESS ROUTES
*****************************************************************************/

app.get('/docs', require('./routes/docs')(config));

if (!config.isUaaConfigured()) { 
  // no restrictions
  app.use(express.static(path.join(__dirname, process.env['base-dir'] ? process.env['base-dir'] : '../public')));

  // mock UAA routes
  app.get(['/login', '/logout'], function(req, res) {
    res.redirect('/');
  })
  app.get('/userinfo', function(req, res) {
      res.send({user_name: 'Sample User'});
  });
} else {
  //login route redirect to predix uaa login page
  app.get('/login',passport.authenticate('predix', {'scope': ''}), function(req, res) {
    // The request will be redirected to Predix for authentication, so this
    // function will not be called.
  });

  // route to fetch user info from UAA for use in the browser
  app.get('/userinfo', userInfo(config.uaaURL), function(req, res) {
    res.send(req.user.details);
  });

  // access real Predix services using this route.
  // the proxy will add UAA token and Predix Zone ID.
  app.use(['/predix-api', '/api'],
  	passport.authenticate('main', {
  		noredirect: true
  	}),
  	proxy.router);

  //callback route redirects to secure route after login
  app.get('/callback', passport.authenticate('predix', {
  	failureRedirect: '/'
  }), function(req, res) {
  	console.log('Redirecting to secure route...');
  	res.redirect('/');
    });

  if (config.rmdDatasourceURL && config.rmdDatasourceURL.indexOf('https') === 0) {
    app.get('/api/datagrid/*', 
        proxy.addClientTokenMiddleware, 
        proxy.customProxyMiddleware('/api/datagrid', config.rmdDatasourceURL, '/services/experience/datasource/datagrid'));
  }

  //Use this route to make the entire app secure.  This forces login for any path in the entire app.
  app.use('/', passport.authenticate('main', {
    noredirect: false //Don't redirect a user to the authentication page, just show an error
  }),
    express.static(path.join(__dirname, process.env['base-dir'] ? process.env['base-dir'] : '../public'))
  );

  //Or you can follow this pattern to create secure routes,
  // if only some portions of the app are secure.
  app.get('/secure', passport.authenticate('main', {
    noredirect: true //Don't redirect a user to the authentication page, just show an error
    }), function(req, res) {
    console.log('Accessing the secure route');
    // modify this to send a secure.html file if desired.
    res.send('<h2>This is a sample secure route.</h2>');
  });

}

/*******************************************************
SET UP MOCK API ROUTES
*******************************************************/
// NOTE: these routes are added after the real API routes. 
//  So, if you have configured asset, the real asset API will be used, not the mock API.
// Import route modules
var mockAssetRoutes = require('./routes/mock-asset.js')();
var mockTimeSeriesRouter = require('./routes/mock-time-series.js');
var mockRmdDatasourceRoutes = require('./routes/mock-rmd-datasource.js')();
// add mock API routes.  (Remove these before deploying to production.)
app.use(['/mock-api/predix-asset', '/api/predix-asset'], jsonServer.router(mockAssetRoutes));
app.use(['/mock-api/predix-timeseries', '/api/predix-timeseries'], mockTimeSeriesRouter);
app.use(['/mock-api/datagrid', '/api/datagrid'], jsonServer.router(mockRmdDatasourceRoutes));
require('./routes/mock-live-data.js')(httpServer);
// ***** END MOCK ROUTES *****

// route to return info for path-guide component.
app.use('/learningpaths', require('./routes/learning-paths')(config));

//logout route
app.get('/logout', function(req, res) {
	req.session.destroy();
	req.logout();
  passportConfig.reset(); //reset auth tokens
  res.redirect(config.uaaURL + '/logout?redirect=' + config.appURL);
});

app.get('/favicon.ico', function (req, res) {
	res.send('favicon.ico');
});

app.get('/config', function (req, res) {
  let title = "Predix WebApp Starter";
  if (config.isAssetConfigured()) {
    title = "RMD Reference App";
  }
  res.send({wsUrl: config.websocketServerURL, appHeader: title});
});

app.post('/api/timeseries', function (req, res){
    if(sendData(req.body.data)){
      res.send('ingested');
    }
});

function sendData(data){
  var sensorId = data.sensorId;
  const ws = new WebSocket('wss://gateway-predix-data-services.run.aws-usw02-pr.ice.predix.io/v1/stream/messages',
    [],
    {
      'headers':{
       'predix-zone-id': data.zoneId,
       'content-type': 'application/json',
       'origin': '*',
       'authorization': 'Bearer '+data.token
      } 
    }
  );

  ws.on('error', function error(res){
    return 'error';
  })

  return ws.on('open', function (){
    var payload = {
      "messageId": Date.now(),
      "body": [
        {
          "name": sensorId,
          "datapoints": [
            [
              Date.now(),
              Math.floor(Math.random() * 200) - 50,
              3
            ]
          ]
        }
      ]
    }
    ws.send(JSON.stringify(payload), function ack(error){
      if(!error)
        return "error";
      else
        return "ingested";
    });
    
  });
}

////// error handlers //////
// catch 404 and forward to error handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// development error handler - prints stacktrace
if (node_env === 'development') {
	app.use(function(err, req, res, next) {
		if (!res.headersSent) {
			res.status(err.status || 500);
			res.send({
				message: err.message,
				error: err
			});
		}
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	if (!res.headersSent) {
		res.status(err.status || 500);
		res.send({
			message: err.message,
			error: {}
		});
	}
});

httpServer.listen(process.env.VCAP_APP_PORT || 5000, function () {
	console.log ('Server started on port: ' + httpServer.address().port);
});

module.exports = app;