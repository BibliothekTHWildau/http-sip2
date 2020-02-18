'use strict';

const config = require('./config');

var express = require('express'),
        app = express(),
        port = process.env.PORT || 3000;

//const unidosRouter = require('./routes/unidos');
//const systemRouter = require('./routes/system');
const sip2Router = require('./routes/sip2');

// sip2 service
const SIP2SERVICE = require('./sip2/Sip2Service');
const sip2Service = new SIP2SERVICE((err) => {
      
      if (err) {
        console.log(`Error while building Sip2Service`);
        console.log(err);
        process.exit();
      }
      console.log("Sip2Service up and running - listening for your requests")
});

// Downtime management
if (config.sip2.downtime){
  //const Downtime = require('./sip2/Downtime');
  //Downtime.init();
}

if (process.env.NODE_ENV !== 'production'){
  const allowCrossDomain = function(req, res, next) {
    var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
    console.log("IP: " + ip)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('content-type','text/html; charset=UTF-8');
    next();
  }
  app.use(allowCrossDomain);
}

// unidos middleware
/*const Unidos = require('./unidos/UnidosService');
const uni = new Unidos(sip2Service,(err)=>{
  if (err){
    console.log(` )-: it seems that UnidosService is not starting properly.`);
    console.log(err);
    process.exit();
  }
});
*/

// before: app.use(app.router);
app.use(function (req, res, next) {
  console.log(req.headers['x-forwarded-for'],req.connection.remoteAddress)
  req.sip2 = sip2Service;
  // unidos middleware
//  req.uni = uni;
  res.set({ 'content-type': 'application/json; charset=utf-8' });
  next();
});

// unidos middleware
//app.use('/unidos', unidosRouter);
//app.use('/system', systemRouter);
app.use('/sip2', sip2Router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).send("404");
});

app.listen(port);


console.log('started ' + port);