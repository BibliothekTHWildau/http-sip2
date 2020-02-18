'use strict';
var express = require('express');
var router = express.Router();


router.get('/status', function(req, res, next) {
   
  req.uni.handle({"type":"status"})
  .then( (item) => {res.send(item) })
  .catch( err => res.status(500).send(err) );
  
});

module.exports = router;
