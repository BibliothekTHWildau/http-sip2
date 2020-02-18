'use strict';
var express = require('express');
var router = express.Router();
var Helpers = require('../Helpers');

/**
 * returns a patron object withoud loading items, faster for overview purpose
 */
router.get('/patronAccount/simple/:patronIdentifier', function(req, res, next) {
  
  if (!Helpers.isPatronId(req.params.patronIdentifier))
    return next();
  
  req.uni.handle({"type":"patronAccount","patronId":req.params.patronIdentifier })
  .then( (patron) => {res.send(patron) })
  .catch( err => res.status(500).send(err) );
  
});


/**
 * sends detailed user account including items
 * if param parts is set, several responses with a json object string will be sent, client has to make sure to handle several chunks
 */
router.get('/patronAccount/detailed/:patronIdentifier/:parts([0-9]{1,2})?', function(req, res, next) {
  
  if (!Helpers.isPatronId(req.params.patronIdentifier))
    return next();
  
  if (req.params.parts){
    
    // send several json-objects as defined in param parts
    
    res.set({ 'content-type': 'text/html; charset=utf-8' });
  
    req.uni.handle({"type":"patronAccountDetailPartial","patronId":req.params.patronIdentifier, "sendParts": parseInt(req.params.parts) }, (partialResponse) => {
      res.write(JSON.stringify(partialResponse));
    })
    .then( (patron) => {
        //res.send(patron)
        res.write(JSON.stringify(patron));
        res.end(); 
      })
    .catch( err => res.status(500).send(err) );
    
  } else {
    
     // we can add different itemTypes later: ["hold","overdue","charged","fine","recall","unavailable","fee"]
    req.uni.handle({"type":"patronAccountDetail","patronId":req.params.patronIdentifier , "itemType" : req.params.itemType || "charged" })
    .then( (patron) => {res.send(patron) })
    .catch( err => res.status(500).send(err) );
    
  }
 
});

/**
 * renew an item
 */
router.get('/renew/:patronIdentifier/:itemIdentifier/:apiVersion?', function(req, res, next) {
  
  if (!Helpers.isPatronId(req.params.patronIdentifier) || !Helpers.isItemId(req.params.itemIdentifier))
    return next();
  
  req.uni.handle({"type":"renew", "patronId":req.params.patronIdentifier, "itemIdentifier" :  req.params.itemIdentifier, "isUnidos" : true, "apiVersion": req.params.apiVersion ? req.params.apiVersion : ""})
  .then( (renew) => {res.send(renew) })
  .catch( err => res.status(500).send(err) );
});


module.exports = router;
