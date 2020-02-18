'use strict';

const config = require('../config');
/* 
 * unidos needs patronaccount not just patron info
 */

var reqId = 0;

var benchStart;
var benchEnd;

class Unidos {

  constructor(sip2handle,errCb) {
    //this.onResponse = onResponse;
    this.errors = [];
    this.sip2handle = sip2handle;
    
  }

  buildResponseFrame(type, sendParts = false, apiVersion = false) {
    return {
      isComplete : true,
      
      type: type,
      sendParts : Number.isInteger(sendParts) ? sendParts : sendParts === true ? 20 : false, 
      data: {},
      benchStart : new Date(),
      apiVersion : apiVersion
    }
    
  }
   
  getRenewInfo(sip2){
    return {
      "renewalOk" : sip2.renewalOk,
      //"message" : sip2.screenMessage,
      "message" : sip2.screenMessage.join("\n"),
      "dueDate" : this.getDate(sip2.dueDate),
      "dueDateString" : sip2.dueDate,
      "titleIdentifier" :sip2.titleIdentifier,
      "itemIdentifier" : sip2.itemIdentifier,
      "patronIdentifier": sip2.patronIdentifier
    }
  }
  
  getItem(sip2){
    return {
      "titleIdentifier" :sip2.titleIdentifier,
      "itemIdentifier" : sip2.itemIdentifier,
      "owner" : sip2.owner,
      "dueDateString" : sip2.dueDate,
      "dueDate" : this.getDate(sip2.dueDate)
    }
  }
  
  getPatron(sip2){
    return {
      "holdItemsCount": sip2.holdItemsCount,
      "overdueItemsCount": sip2.overdueItemsCount,
      "chargedItemsCount": sip2.chargedItemsCount,
      "fineItemsCount": sip2.fineItemsCount,
      "recallItemsCount": sip2.recallItemsCount,
      "unavailableHoldsCount": sip2.unavailableHoldsCount,
      "validPatron": sip2.validPatron,
      "fees" : sip2.feeAmount + sip2.currencyType,
      "patronIdentifier": sip2.patronIdentifier,
      "personalName": sip2.personalName,
      "items": sip2.items || []
    }
  }
  
  getDate(dateString){
    let temp;
    if (/^(\d{2}).(\d{2})\.(\d{4})$/.test(dateString)){
      temp = /^(\d{2}).(\d{2})\.(\d{4})$/.exec(dateString)
      return `${temp[3]}-${temp[2]}-${temp[1]}`;
    }
    
    return dateString;
  }
   
  
  handle(request, partialResponseFunc = false) {
    
    return new Promise((resolve, reject) => { 
      
      console.log("Unidos handle",JSON.stringify(request));
      let benchStart = new Date();
    
      let response = this.buildResponseFrame(request.type, request.sendParts, request.apiVersion); 
      
      switch (request.type) {
        
        case "status":
       
          response.data.status = this.sip2handle.getStatus();          
          return resolve(response);

        break;
        
        // Unidos requests -> build complex responses        
        case "patronAccount": // calls patron info with hold items - will be faster than charged items - shall only return a quick overview of patron
          this.sip2handle.handle({type: "patronInformation", patronId: request.patronId, itemType: "hold", highPriority : true})
          .then( patronInfo => { 
            response.data.patron = this.getPatron(patronInfo);   
            return resolve(response);
          })
          .catch(err => { 
            return reject(err); 
          });         
          
        
        break;
        
        case "patronAccountDetail": 
          // first send patron info to sip2handler and get all charged items
          this.sip2handle.handle({type: "patronInformation", patronId: request.patronId, itemType: request.itemType })
          .then( (patronInfo) => {
            
            let patron = this.getPatron(patronInfo);

            //response.data.patron = patronInfo.patron;
            patron.itemsDone = 0;
            patron.itemsToDo = patron.items.length;

            response.data.patron = patron;

            // no books - respond
            if (patron.items.length === 0)
              return resolve(response);
            
            for (let i = 0; i < patron.items.length; i++){
              this.sip2handle.handle({type: "itemInformation", itemIdentifier: patron.items[i] })
              .then( (itemInfo) => {
                patron.items[i] = this.getItem(itemInfo);
                patron.itemsDone++;

                if (patron.itemsDone === patron.itemsToDo ){                  
                  return resolve(response);
                }
              })
              .catch(err => { 
                return reject(err); 
              });
            }
            
          } )
          .catch(err => { 
            return reject(err); 
          });
          
          
        break;
        
        case "patronAccountDetailPartial":
          
          this.sip2handle.handle({type: "patronInformation", patronId: request.patronId, itemType: request.itemType })
          .then( (patronInfo) => {
            let patron = this.getPatron(patronInfo);
            let patronIdentifier = patron.patronIdentifier;

            //response.data.patron = patronInfo.patron;
            patron.itemsDone = 0;
            patron.itemsToDo = patron.items.length;


            // no books - respond
            if (patron.items.length === 0){
              response.data.patron = patron;
              return resolve(response);
            }
            // partial response part
            // first part
            response.isPartialResponse = true; // tell unidos there is coming
            response.isComplete = false;

            // separate the items
            let items = patron.items.slice(0);
            patron.items = [];

            let temp = {};
            
            for (let i = 0; i < items.length; i++){
              this.sip2handle.handle({type: "itemInformation", itemIdentifier: items[i]})
              .then( (itemInfo) => {
                temp = {};
                patron.items.push(this.getItem(itemInfo));
                patron.itemsDone++;
                // all items done, this must be checked first in case item.length == sendParts.length, this would respond two times
                if (patron.itemsDone === patron.itemsToDo ){ 
                  response.data.patron = Object.assign(temp,patron);  

                  response.isComplete = true;
                  return resolve(response);
                  //return callback(null,{ reqType : temp.type, responseData :temp.patron, reqDuration : (benchEnd.getTime() - benchStart.getTime())})
                }

                // sendParts is reached - we send a partial response
                if (patron.itemsDone % response.sendParts === 0){

                  // temp gets all values of patron and response.data.patron gets temp
                  response.data.patron = Object.assign(temp,patron);
                  
                  if (partialResponseFunc)
                    partialResponseFunc(response);
                  
                  // stripping down patron
                  patron = {
                    patronIdentifier : patronIdentifier,
                    items : [],
                    itemsDone : patron.itemsDone,
                    itemsToDo : patron.itemsToDo
                  }
                }
              })
              .catch(err => { 
                return reject(err); 
              });
            }
            
          })
          .catch(err => { 
            return reject(err); 
          });
          
        
        break;
        
        // raw sip2 -> only pure sip2 requests (exception is renew)
        
        
        case "renew":
          this.sip2handle.handle({type: "renew", patronId: request.patronId, itemIdentifier: request.itemIdentifier, noBlock : request.noBlock, nbDueDate : request.nbDueDate })
          .then( (renew) => {
            if (request.isUnidos){
              response.data.renew = this.getRenewInfo(renew);
              if (request.apiVersion === "1")
                response.rawdata = renew.raw;
            } else {
              response.data = renew;
            }
            return resolve(response);
          } )
          .catch(err => { 
            return reject(err); 
          });
          
          
        break;
      
        case "renewAll":
        break;
              
        
        default: 
          response.error = true;
          response.errorMsg = "type not implemented";
          console.log("Error Unidos handle request type not implemented",response.type);
          return resolve(response); break;
      }
      
    })

  }
}

module.exports = Unidos;