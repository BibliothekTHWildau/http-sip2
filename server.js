'use strict';

const config = require('./config');

var express = require('express'),
        app = express(),
        port = process.env.PORT || 3000;

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
const Downtime = require('./sip2/Downtime');
if (config.sip2.downtime){
  
  Downtime.init();
}

const clientIsAllowed = function(req, res, next) {
  // restrict to allowed clients from list
  // auth is done by reverse proxy
  if (config.allowedClients.indexOf(req.connection.remoteAddress) > -1)
    return next()
  else 
    return res.status(403).send("forbidden");
}
app.use(clientIsAllowed);

if (process.env.NODE_ENV !== 'production'){
  const allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('content-type','text/html; charset=UTF-8');
    next();
  }
  app.use(allowCrossDomain);
}

// unidos middleware
var Unidos, uni;
if (config.unidos){
  Unidos = require('./unidos/UnidosService');
  uni = new Unidos(sip2Service,(err)=>{
  if (err){
    console.log(` )-: it seems that UnidosService is not starting properly.`);
    console.log(err);
    process.exit();
  }
});
}

// before: app.use(app.router);
app.use(function (req, res, next) {
  res.set({ 'content-type': 'application/json; charset=utf-8' });
  if (Downtime.isDowntime){
    
    return res.status(503).json({ msgType : "response", response : "Dieser Dienst steht ab " + Downtime.downTimeEnds + " wieder zur Verfügung. Bitte versuchen sie es dann noch einmal.", isComplete: true });
  }
            
  req.sip2 = sip2Service;
  // unidos middleware
  if (config.unidos){
    req.uni = uni;
  }  
  
  next();
});

// unidos middleware
if (config.unidos){
  const unidosRouter = require('./routes/unidos');
  const systemRouter = require('./routes/system');
  app.use('/unidos', unidosRouter);
  app.use('/system', systemRouter);
}
app.use('/sip2', sip2Router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  res.status(404).send("404");
});

app.listen(port);


console.log('started ' + port);