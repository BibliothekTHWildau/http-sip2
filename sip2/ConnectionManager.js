'use strict';

const Connection = require('./Connection');
const config = require('../config');
const connPool = process.env.NODE_ENV !== "production" ? config.sip2.testConnections : config.sip2.connections;

const Downtime = require('./Downtime');

const OFFLINE = 0;
const ONLINE = 1;
const ESTABLISHING = -1;
const MAXRECONNECTSREACHED = 2;

class ConnectionManager {

  constructor(callback) {
    this.connections = {};//this.connections = [];
    this.errors =  [];
    this.requestQueue = [];
    
    this.init();
    this.onReady = callback;
    
    /**
      * downtime management
      */
    if (config.sip2.downtime){
      Downtime.register( () => {this.onDowntimeEvent()});
    } 
  }
  
  onDowntimeEvent(){
    
    if (Downtime.isDowntime){
      // end connections
      for (let i in this.connections){
        this.connections[i].pause();
        
      }
    } else {
      // resume
      for (let i in this.connections){
        this.connections[i].resume();
        
      }
    }
    
  }
  
  init(){
    for (let i = 0; i < connPool.length; i++){
      let aConnection = new Connection(i , connPool[i],  (conn)=>{ this.onConnectionSuccess(conn) }, (conn,err)=>{ this.onConnectionError(conn,err) });
      this.connections[i] = aConnection;
      aConnection.connectAndLogin();
    }
  }
  
  /***
   * called when a socket connection opened and login request got a vaild login response
   * onReady is a listener on startup of the application, it gets set to false when at least one connection is open and the calling class (siphandler) gets informed about an online state
   * @param {type} conn
   * @returns {undefined}
   */
  onConnectionSuccess(conn){
    
    // if the first connection is opened tell the calling class
    if (this.onReady){
      this.onReady(this.getStatus());
      this.onReady = false;
    }
      
    console.log(`ConnectionManager Status report ${JSON.stringify(this.getStatus())}`);
    
    // test if requests are in queue
    if (this.requestQueue.length > 0){
      let temp = this.requestQueue.shift();
      console.log('ConnectionManager (after [re]connect event) From queue. Queuesize:',this.requestQueue.length);
      this.send(temp.request, temp.callback);
    }
    
  }
  
  onConnectionError(conn,err){
    let status = this.getStatus();
    console.log(`ConnectionManager Status report ${JSON.stringify(status)}`);
    
    // as long as the connection does not reach the max retry value we try a reconnect on that connection
    if (conn.state !== MAXRECONNECTSREACHED){
      return conn.reconnect();
    }
    
    // if all connections are offline and we have a onReady set, we tell the caller that Connectionmanager fails to open a connection
    if (status.establishing === 0 && this.onReady){
      
      this.onReady(status);
      this.onReady = false;
    } 
    
    // all connections are down during normal operations
    if (status.online === 0 && !this.onReady){
      // we do not need this: if reconnectCount is less than max, a reconnect is called befor this if-statement
      // the next if statement is called when all connections reached max reconnectCount
    }
    
    // maxReconnectionsReached = number of all connections = all connections have max retery count
    if (status.maxReconnectionsReached === Object.keys(this.connections).length ){
      console.log("ALL CONNECTIONS DOWN AND MAXRECONNECTS REACHED -")
      process.exit(1)
    }
    
    // remove connection from list of connections?
    //this.connections.splice(id, 1);
    // or retry a reconnect?
    
  }
  
  send(request, callback, hasPriority = false){
   
    //console.log('ConnectionManager calling send');
    let idleConenction = this.getIdleConnection();
    
    // adding request to queue
    if (!idleConenction){
      if (hasPriority){
        // put request to top of queue
        this.requestQueue.unshift({request : request, callback : callback, hasPriority : hasPriority});
      }
      else {
        // put request to end of queue
        this.requestQueue.push({request : request, callback : callback, hasPriority : hasPriority});
      }
      console.log('ConnectionManager No idle connection found, putting to queue. Queuesize:',this.requestQueue.length);
    }
    else {
      idleConenction.send(request,(err,response)=>{
        
        callback(err,response);
        
        // if the queue has items
        if (this.requestQueue.length > 0){
          let temp = this.requestQueue.shift();
          console.log('ConnectionManager From queue. Queuesize:',this.requestQueue.length);
          this.send(temp.request, temp.callback, temp.hasPriority);
        }
      }) 
    }
  }
  
  getIdleConnection(){
    for (let i in this.connections){
      
      if (this.connections[i].idle)
        return this.connections[i]
    }
    
    // no idle connection found
    return false;
  }
  
  getQueueLength(){
    return this.requestQueue.length;
  }
  
  getStatus(){
    
    let offlineCount = 0;
    let onlineCount = 0;
    let establishingCount = 0;
    let maxReconnectionsReached = 0
    
    for (let i in this.connections){
      if (this.connections[i].state === ONLINE){
        onlineCount++;
      } else if (this.connections[i].state === OFFLINE){
        offlineCount++;
      } else if (this.connections[i].state === MAXRECONNECTSREACHED){
        maxReconnectionsReached++;
      } else {
        establishingCount++;
      }
    }
    
    return {
      online : onlineCount,
      offline : offlineCount,
      establishing: establishingCount,
      maxReconnectionsReached : maxReconnectionsReached
    }
  }
}

module.exports = ConnectionManager;
