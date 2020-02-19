'use strict';

const net = require('net');
const SIP2 = require('sip2');
const parseResponse = require('../node_modules/sip2/lib/parseResponse');
const OFFLINE = 0;
const ONLINE = 1;
const ESTABLISHING = -1;
const MAXRECONNECTSREACHED = 2;

const config = require('../config');

class Connection {

  constructor( id,  conf, onSuccess, onError) {
    
    this.reconnects = 0;
    this.maxReconnectionAtempts = config.sip2.maxReconnectionAttempts;
    this.onSuccess = onSuccess; // function
    this.onError = onError; // function
    this.onResponse = null; // a callback set on each send call
    this.idle = true;
    this.id = id;
    this.host = conf.host;
    this.port = conf.port;
    this.user = conf.userId;
    this.pass = conf.password;
    this.locationCode = conf.locationCode;
    this.keepalive = conf.keepalive || false;
    this.socket = null;    
    this.state = ESTABLISHING;
    this.dataChunk = "";
    this.connectTimer = null;
    this.lastDataTransfer = new Date(); // used in keepalive timer
    this.keepaliveTimer = null;
    this.reconnectTimer = null;
    
    this.responseTimeoutTimer = null; // we send a request, if server dies we cancel it
    
    this.isPaused = false; // downtime management
  }

  connect(callback) {
    
    
    this.socket = new net.Socket();
    
    // by enabling timeout socket will close on idle, also on connect (there we cannot catch connection error)
    //this.socket.setTimeout(3000, ()=>{ this.socket.destroy()});
    
    this.socket.setEncoding(config.sip2.encoding);
    
    this.socket.on('error', (error) => {
      console.log(`[${this.id}] Socket connection error:`,JSON.stringify(error));
      // -> calls close event
      this.socket.destroy();
    });
    
    this.socket.on('timeout', () => {
      console.log(`[${this.id}] TIME OUT`);      
    });

    this.socket.on('end', () => {
      console.log(`[${this.id}] Socket Disconnected END`);      
      // -> calls close event
    });

    this.socket.on('close', () => {
      console.log(`[${this.id}] CLOSEd Socket connection`);
      
      if (this.reconnects < this.maxReconnectionAtempts)
        this.state = OFFLINE;
      else
        this.state = MAXRECONNECTSREACHED;
      
      // cancel the connectTimer so that it does not fire again
      if (this.connectTimer)
        clearTimeout(this.connectTimer);
      
      if (this.keepalive && this.keepaliveTimer){
        clearTimeout(this.keepaliveTimer);
      }
      
      //if (this.responseTimeoutTimer)
        //clearTimeout(this.responseTimeoutTimer);
      
      //  callback 
      if (this.onResponse)
        this.onResponse("socket closed", null); 
            
      // tell connection manager that a connection closed
      this.onError(this,"closed");
 
    });
    
    this.socket.on('connect', () => {
      console.log(`[${this.id}] Socket CONNECTed`);
      this.reconnects = 0;
      
      clearTimeout(this.connectTimer);
            
      callback();
      
    });
    
    this.socket.on('data', (data) => {
            
      this.dataChunk += data;

      // we wait for a carriage return
      if (data.charCodeAt(data.length-1) === 13){
        // print raw datastring
        console.log(`[${this.id}] <<< ${data.substr(0,data.length-1)}`);
         
        let temp = this.dataChunk;
        this.dataChunk = "";
        
        this.idle = true;
        
        // clear the timer
        if (this.responseTimeoutTimer){
          clearTimeout(this.responseTimeoutTimer);
        } else console.log("WHERE IS MY TIMEOUT?");
                        
        // keepalive checks lastDataTransfer
        this.lastDataTransfer = new Date();
        
        // when in downtime
        if (this.isPaused){
          this.socket.destroy();
          this.idle = false;
        }
        //  callback at last to avoid race conditions do
        this.onResponse(null, temp); 
        
      } else {
        console.log(`[${this.id}] <<< ${data} ...`);        
      }
      
    });

    this.socket.connect(this.port, this.host);
    
    // this timer is fired when a connection is not established
    this.connectTimer = setTimeout(()=> {
      console.log(`[${this.id}] [ERROR] Attempt at connection exceeded TIMEOUT value`);
      //device.clientSocket.end();
      this.socket.destroy();

    }, 5000);
        
    
    //return this;
  }
  
  /**
   * sets socket on pause, will prevent from (re)connect
   * included with downtime feature
   * @returns {undefined}
   */
  pause(){
    console.log(`[${this.id}] PAUSE`);
    this.isPaused = true;
    
    if (this.idle){
      this.socket.destroy();
      this.idle = false;
    }
  }
  
  /**
   * ends pause mode
   * @returns {undefined}
   */
  resume(){
    console.log(`[${this.id}] RESUME`);
    this.isPaused = false;
    this.idle = true;
    this.connectAndLogin();
  }
  
  /**
   * triggers a reconnect after a specified timeout
   * @returns {undefined}
   */
  reconnect(){
    // if there is aleady a reconnectTimer we return
    if (this.reconnectTimer)
      return false;
    
    this.reconnects++;
    
    console.log(`[${this.id}] Reconnect in ${config.sip2.reconnectTimeout}`);
    this.reconnectTimer = setTimeout(()=> {
        this.reconnectTimer = null;
        this.connectAndLogin();
    }, config.sip2.reconnectTimeout);
  }
  
  /***
   * connect to socket and, if successful, send a sip2 login message (93..)
   * 
   * @returns {undefined}
   */
  connectAndLogin(){
    console.log(`[${this.id}] Connection.connectAndLogin`,this.host, this.port, this.user);
    
    if (this.isPaused){
      return console.log(`[${this.id}] is PAUSED , no connect is called`);
    }
    
    this.connect( (err) => {
      if (err){
        //console.log(`[${this.id}] Connection.connectLogin connect error`,this.host, this.port, this.user)
        return this.onError(this,"err");
      }
      const loginRequest = new SIP2.LoginRequest(this.user, this.pass, this.locationCode);
      //console.log(loginRequest.getMessage())

      this.send(loginRequest.getMessage(), (err, loginResponse) => {
        if (err)
          return this.onError(this,"err");// test
        
        // parse responseString into object
        try {
          loginResponse = parseResponse(loginResponse);
          //console.log("loginResponse:" , loginResponse)
        } catch (exc){
          // login response is no valid/implemented response
          console.log(`[${this.id}] the parsing of loginResponse returned the following error: ${exc}`);
          return this.onError(this,'parseResponse error');
        }
        
        // login rsponse says it is no valid login
        if (!loginResponse.ok) {
          console.log(`[${this.id}] Login error`);
          return this.onError(this,'error Login error');
          
        }
        
        this.state = ONLINE;
        
        // keepalive 
        if (this.keepalive){
          console.log(`[${this.id}] Socket will send keepalive requests every ${this.keepalive}`)
          this.keepaliveTimer = setInterval( ()=> {this.sendKeepalive() }, this.keepalive)
        }
        
        return this.onSuccess(this);        
        
      });
    });
  }

  /**
  * 
  * @param {type} request
  * @param {type} callback
  * @returns {undefined}
  */
  send(request, callback) {
    
    this.onResponse = callback;
    if (!this.socket) {
      callback(new Error('No open SIP2 socket connection'));
    }
    
    this.idle = false;
    
    console.log(`[${this.id}] >>> ${request.substr(0,request.length-1)}`);
    
    this.socket.write(request);
    
    this.responseTimeoutTimer = setTimeout(()=> {
      console.log(`[${this.id}] [ERROR] response exceeded TIMEOUT value ${config.sip2.responseTimeout}`);
      //console.log(callback);
      this.onResponse(new Error('Timeout reached - SIP2-Server did not respond in ' + config.sip2.responseTimeout));
      //device.clientSocket.end();
      this.socket.destroy();

    },  config.sip2.responseTimeout);
  }

  /**
  * 
  * @returns {undefined}
  */
  close() {
    if (this.socket) {
      // Add message
      this.socket.end();
    }
  }
  
  /**
   * sends a keepalive request if last data transfer is a defined timespan ago, 
   * response is dismissed
   * @returns {Boolean}
   */
  sendKeepalive(){
    
    let now = new Date();
    
    //console.log(`${now.getTime()},${this.lastDataTransfer.getTime()}, ${this.keepalive}, ${this.idle}, == ${now.getTime() - this.lastDataTransfer.getTime()}`)
    // 10:30:20          10:20:21    + 5.000                     10:00
    if (now.getTime() - this.lastDataTransfer.getTime() + 5000 < this.keepalive || !this.idle){
      //console.log(`[${this.id}] sendKeepalive is called - time between last data transfer and now is too small - no keepalive will be sent`);
      return false;
    }
    
    console.log(`[${this.id}] Keepalive:`);
    const SCStatusRequest = new SIP2.SCStatusRequest();
    this.send(SCStatusRequest.getMessage(),(err,keepaliveResponse)=>{ 
      if (err){
        console.log(`[${this.id}] Error during keepalive request: ${err}`);
      } else {
        keepaliveResponse = parseResponse(keepaliveResponse);
      //  console.log(`[${this.id}] keepalive response onLineStatus: ${keepaliveResponse.onLineStatus}`);
        //console.log(keepaliveResponse) ;
      }
    });
    
    // maybe add a setTimeout to check whether keepalive came back
  }
  
  
  getConnection(){
    return this;
  }
}

module.exports = Connection;
