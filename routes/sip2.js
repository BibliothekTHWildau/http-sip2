'use strict';
var express = require('express');
var router = express.Router();
var Helpers = require('../Helpers');

router.get('/scstatus', function (req, res, next) {

  req.sip2.handle({ "type": "scStatus" })
    .then((scstatus) => { res.send(scstatus) })
    .catch(err => res.status(500).send(err));

});

router.get('/itemInformation/:itemIdentifier', function (req, res, next) {

  if (!Helpers.isItemId(req.params.itemIdentifier))
    return next();

  req.sip2.handle({ "type": "itemInformation", "itemIdentifier": req.params.itemIdentifier })
    .then((item) => { res.send(item) })
    .catch(err => res.status(500).send(err));

});

router.get('/patronInformation/:patronIdentifier/:itemType?', function (req, res, next) {

  if (!req.params.itemType)
    req.params.itemType = 'hold'

  if (!Helpers.isPatronId(req.params.patronIdentifier) || !["hold", "overdue", "charged", "fine", "recall", "unavailable", "fee"].indexOf(req.params.itemType) === -1)
    return next();

  // { type: "patronInfo", patronId: request.patronId, itemType: request.itemType }
  req.sip2.handle({ "type": "patronInformation", "patronId": req.params.patronIdentifier, "itemType": req.params.itemType })
    .then((patron) => { res.send(patron) })
    .catch(err => res.status(500).send(err));

});

// the following params can be set but have no use in our server 
// "noBlock" : noBlock, "nbDueDate" : nbDueDate
router.get('/renew/:patronIdentifier/:itemIdentifier/:nbDueDate?', function (req, res, next) {

  if (!Helpers.isPatronId(req.params.patronIdentifier) || !Helpers.isItemId(req.params.itemIdentifier))
    return next();

  // {type: "renew", patronId: request.patronId, itemIdentifier: request.itemIdentifier, noBlock : request.noBlock, nbDueDate : request.nbDueDate }
  // toDO
  req.sip2.handle({ "type": "renew", "patronId": req.params.patronIdentifier, "itemIdentifier": req.params.itemIdentifier, "nbDueDate": req.params.nbDueDate, "noBlock": req.params.nbDueDate ? true : false })
    .then((patron) => { res.send(patron) })
    .catch(err => res.status(500).send(err));
});

// todo add cancel for failed checkin: https://developers.exlibrisgroup.com/alma/integrations/selfcheck/sip2/
router.get('/checkout/:patronIdentifier/:itemIdentifier/:nbDueDate?', function (req, res, next) {

  if (!Helpers.isPatronId(req.params.patronIdentifier) || !Helpers.isItemId(req.params.itemIdentifier))
    return next();

  // {type: "checkout", patronId: request.patronId, itemIdentifier: request.itemIdentifier, noBlock : request.noBlock, nbDueDate : request.nbDueDate }
  // TODO
  req.sip2.handle({ "type": "checkout", "patronId": req.params.patronIdentifier, "itemIdentifier": req.params.itemIdentifier, "nbDueDate": req.params.nbDueDate, "noBlock": req.params.nbDueDate ? true : false })
    .then((patron) => { res.send(patron) })
    .catch(err => res.status(500).send(err));
});

// todo add cancel for failed checkout
router.get('/checkin/:itemIdentifier', function (req, res, next) {

  if (!Helpers.isItemId(req.params.itemIdentifier))
    return next();

  // {type: "checkin", itemIdentifier: request.itemIdentifier, noBlock : request.noBlock, nbDueDate : request.nbDueDate }
  // TODO
  req.sip2.handle({ "type": "checkin", "itemIdentifier": req.params.itemIdentifier })
    .then((patron) => { res.send(patron) })
    .catch(err => res.status(500).send(err));
});


router.get('/hold/:patronIdentifier/:itemIdentifier', function (req, res, next) {

  if (!Helpers.isPatronId(req.params.patronIdentifier) || !Helpers.isItemId(req.params.itemIdentifier))
    return next();


  req.sip2.handle({ "type": "hold", "patronId": req.params.patronIdentifier, "itemIdentifier": req.params.itemIdentifier })
    .then((patron) => { res.send(patron) })
    .catch(err => res.status(500).send(err));
});

// FeePaidRequest
// todo msg body
router.post('/fee/:patronIdentifier?', function (req, res, next) {

  console.log(req.body)

  let patronId = req.params.patronIdentifier || req.body.patronId;

  if (!req.body?.feeAmount || !/^\d*\.?,?\d{0,2}$/.test(req.body.feeAmount))
    return next()

  if (req.body?.feeType && !/^[\w]{2}$/.test(req.body.feeType))
    return next()

  if (req.body?.paymentType && !/^[\w]{2}$/.test(req.body.paymentType))
    return next()

  if (!Helpers.isPatronId(patronId))
    return next();

  req.sip2.handle({ "type": "feepaid", "patronId": patronId, feeAmount: req.body.feeAmount, feeType: req.body.feeType, paymentType: req.body.paymentType })
    .then((response) => { res.send(response) })
    .catch(err => res.status(500).send(err));
});


module.exports = router;