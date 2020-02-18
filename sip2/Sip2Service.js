'use strict';

const SIP2 = require('sip2');
const config = require('../config');
const ConnectionManager = require('./ConnectionManager');
const parseResponse = require('../node_modules/sip2/lib/parseResponse');

class Sip2Handler { //die main starten

  constructor(callback) {
    
    this.queue = [];
    this.idle = true;
    
    // initiate the connection manager which handles all request
    this.sip2Connection = new ConnectionManager((mngr)=>{
      // connection manager threw an error
      if (mngr.online === 0 && mngr.establishing === 0){
        console.log(`Error: SipHandler.constructor while building ConnectionManager`);
        //console.log(`SipHandler.constructor error on building ConnectionManager: ${JSON.stringify(err)}`);
        return callback();
      }
      
      // mngr.connectionsAvailable is the number of open sip2 channels    
      // else return nothing -> success
      return callback(null);
      
    });   
    
  }
  
  getSip2QueueLength(){    
    return this.sip2Connection.getQueueLength();
  }
  
  getStatus(){
    return  this.sip2Connection.getStatus()
  }


  handle(request){
    return new Promise((resolve, reject) => { 
      console.log("SipHandler handle",JSON.stringify(request));
      
      let temp;
    
      switch (request.type) {
        case "scStatus":      temp = this.requestSCStatus();  break;
        case "patronInformation":    temp = this.requestPatronInformation2(request.patronId, request.itemType, request.highPriority); break;
        case "patronStatus":  temp = this.requestPatronStatus(request.patronId); break;
        case "itemInformation" :     temp = this.requestItemInformation(request.itemIdentifier); break;
        case "renew" :        temp = this.requestRenew(request.patronId, request.itemIdentifier, request.noBlock, request.nbDueDate, request.highPriority); break; 

        // renew over checkout - if commenting in check params
        //case "renew" :        temp = this.requestCheckout(config.sip2.renewViaCheckoutAllowed, request.patronId, request.itemIdentifier, request.highPriority); break;
        case "renewAll" :     temp = this.requestRenewAll(request.patronId); break;
        case "checkout" :     temp = this.requestCheckout(config.sip2.renewViaCheckoutAllowed, request.patronId, request.itemIdentifier, request.noBlock, request.nbDueDate); break;
        case "checkin"  :   temp = this.requestCheckin(request.itemIdentifier, request.noBlock, request.nbDueDate, request.highPriority); break;
      }

      temp.then( responseString => {

        let sip2data = parseResponse(responseString);
        sip2data.raw = responseString;

        resolve(sip2data);    

      }).catch( err => {
        console.log(err)
        reject(err);
      });
      
    });
  }

  requestPatronInformation2(patronId, type = 'charged', highPriority = false) {
    
    return new Promise((resolve, reject) => {

      // Patron information request 
      //hold: 0,
      //overdue: 1,
      //charged: 2,
      //fine: 3,
      //recall: 4,
      //unavailable: 5,
      //const type = 'charged';
      const patronInformationRequest = new SIP2.PatronInformationRequest(type, 1, 2);
      //patronInformationRequest.sequence = 1;
      patronInformationRequest.institutionId = 'THW';
      patronInformationRequest.patronIdentifier = patronId;
      //console.log(patronInformationRequest.getMessage())
      this.sip2Connection.send(patronInformationRequest.getMessage(), (err, patronInformationResponse) => {
        if (err)
          return reject();
        return resolve(patronInformationResponse);
      }, highPriority);

    })

  }
  
  requestPatronStatus(patronId) {
    
    return new Promise((resolve, reject) => {

      const patronStatusRequest = new SIP2.PatronStatusRequest();
      patronStatusRequest.institutionId = 'THW';
      patronStatusRequest.patronIdentifier = patronId;
      //console.log(patronInformationRequest.getMessage())
      this.sip2Connection.send(patronStatusRequest.getMessage(), (err, patronStatusResponse) => {
        if (err)
          return reject();
        return resolve(patronStatusResponse);
      });

    })

  }

  requestItemInformation(itemIdentifier) {
    
    return new Promise((resolve, reject) => {
      // Patron information request
      const itemInformationRequest = new SIP2.ItemInformationRequest(itemIdentifier);

      //console.log(itemInformationRequest.getMessage())
      this.sip2Connection.send(itemInformationRequest.getMessage(), (err, itemInformationResponse) => {
        if (err)
          return reject();
        return resolve(itemInformationResponse);
      });
    })
  }
  
  /**
   * scRenewalPolicy true = renew allowed, checkout will try to renew
   * @param {type} scRenewalPolicy
   * @param {type} patronId
   * @param {type} itemIdentifier
   * @returns {Promise}
   */
  requestCheckout(scRenewalPolicy, patronId, itemIdentifier, noBlock = false, nbDueDate = null, highPriority = false) {
    
    return new Promise((resolve, reject) => {
      
      // scRenewalPolicy, nbDueDate, itemIdentifier, itemProperties, feeAcknowledged, noBlock = false
      const checkoutRequest = new SIP2.CheckoutRequest(scRenewalPolicy, nbDueDate ,itemIdentifier, null, null, noBlock);
      checkoutRequest.patronIdentifier = patronId;
      //console.log(itemInformationRequest.getMessage())
      this.sip2Connection.send(checkoutRequest.getMessage(), (err, checkoutResponse) => {
        if (err)
          return reject();
        return resolve(checkoutResponse);
      }, highPriority);
    })
  }
  
  requestRenew(patronId, itemIdentifier, noBlock = false, nbDueDate = false, highPriority = false) {
    //console.log("params:", patronId, itemIdentifier, noBlock, nbDueDate, highPriority );
    // either send a renew request or send a checkout request with scRenewalPolicy = true
    return new Promise((resolve, reject) => {
      // itemIdentifier, nbDueDate, itemProperties, feeAcknowledged, noBlock = false
      let itemProperties = null;
      let feeAcknowledged = null;
      const renewRequest = new SIP2.RenewRequest(itemIdentifier, nbDueDate, itemProperties, feeAcknowledged, noBlock);
      renewRequest.patronIdentifier = patronId;
      //console.log(renewRequest.getMessage())
      this.sip2Connection.send(renewRequest.getMessage(), (err, renewResponse) => {
        if (err)
          return reject();
        return resolve(renewResponse);
      }, highPriority);
    })
  }
  
  requestRenewAll(patronId) {
    // either send a renew request or send a checkout request with scRenewalPolicy = true
    return new Promise((resolve, reject) => {
      // Patron information request
      const renewAllRequest = new SIP2.RenewAllRequest();
      renewAllRequest.patronIdentifier = patronId;
      
      this.sip2Connection.send(renewAllRequest.getMessage(), (err, renewAllResponse) => {
        if (err)
          return reject();
        return resolve(renewAllResponse);
      });
    })      
  }  

   requestCheckin(itemIdentifier, noBlock = false, nbDueDate = null, highPriority = false) {
    
    return new Promise((resolve, reject) => {
      // returnDate, location, itemIdentifier, itemProperties
      const checkinRequest = new SIP2.CheckinRequest(null, "sip2rest" ,itemIdentifier, null);
      
      console.log(checkinRequest.getMessage())
      this.sip2Connection.send(checkinRequest.getMessage(), (err, checkinResponse) => {
        if (err)
          return reject();
        return resolve(checkinResponse);
      }, highPriority);
    })
  }

  requestSCStatus(){
    return new Promise((resolve, reject) => {
      
      const SCStatusRequest = new SIP2.SCStatusRequest();
      //console.log(SCStatusRequest.getMessage())
      
      this.sip2Connection.send(SCStatusRequest.getMessage(), function(err, ACStatusResponse) {
        if (err)
          return reject();
        return resolve(ACStatusResponse);
      });
    })
  }


}

module.exports = Sip2Handler;