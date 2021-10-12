'use strict';

module.exports = {
    sip2 : {
      encoding: 'latin1',
      institution: 'AOinstitution',
      renewViaCheckoutAllowed : true,
      partialResponse: 20,
      maxReconnectionAttempts : 5,
      reconnectTimeout : 10000,
      responseTimeout : 20000,
      downtime : [ 
        { "beginH": 4, "beginM": 10, "endH": 5, "endM": 20, "begin" : "10 4 * * 0,1,2,4,5,6" , "end" : "20 5 * * 0,1,2,4,5,6" , "w" : [0,1,2,4,5,6]},
        { "beginH": 6, "beginM": 0, "endH": 7, "endM": 0, "begin" : "0 6 * * 3" , "end" : "0 7 * * 3" , "w" : [3]},
        //{ "beginH": 12, "beginM": 37, "endH": 12, "endM": 38, "begin" : "0 6 * * 3" , "end" : "0 7 * * 3" , "w" : [0,1,2,3,4,5,6]}
      ], 
      downTimeTest : true, // will build a downtime begin next minute, end minute after next minute
      connections : [
        {
          host : "hostname",
          port : 1234,
          userId : "sip2user",
          password : "sip2pass",
          locationCode : "sip2ViaNodejs1" + ":00",
          keepalive : 300000
        },
      ],
      testConnections : [
        {
          host : "hostname",
          port : 1234,
          userId : "sip2user",
          password : "sip2user",
          locationCode : "sip2ViaNodejs4" + ":00",
          keepalive : 100000
        },
        /*{
          host : "127.0.0.1",
          port : 8388,
          userId : "fake",
          password : "fake",
          locationCode : "fakeSip2" + ":00",
          keepalive : 30000
          
        }*/
      ]
    }
    
  
}
