'use strict';

const config = require('../config');

var schedule = require('node-schedule');
//var isDowntime = false;
//var downtimes = [];

var Downtime = {
  
  isDowntime : false,
  
  downtimes : [],
  
  listeners : [],
  
  downTimeEnds : "",
  
  register : function(aListener){
    this.listeners.push(aListener);
  },
  
  informListener : function(){
    for (let aListener of this.listeners){
      aListener();
      //console.log("aListener",aListener())
      //if (type of aListener.onDowntimeEvent)
        //aListener.onDowntimeEvent();
    }
  },
  
  init : function(){
        
    console.log("DOWNTIME init:");
    
    let now = new Date();
    
    if (process.env.NODE_ENV !== "production" && config.sip2.downTimeTest){
      config.sip2.downtime.push({ "beginH": now.getHours(), "beginM": (now.getMinutes()+1), "endH": now.getHours(), "endM": (now.getMinutes()+2), "w" : [0,1,2,3,4,5,6]})
    }
  
    for (let cron of config.sip2.downtime){

      // check if every hour/min and days are defined
      if (typeof cron.beginH !== "undefined" && typeof cron.beginM !== "undefined" && typeof cron.endH !== "undefined" && typeof cron.endM !== "undefined" && typeof cron.w !== "undefined"){

        // build a cron like time definition >m h * * d<
        let begin = cron.beginM + " " + cron.beginH + " * * " + cron.w.join(",");
        let end = cron.endM + " " + cron.endH + " * * " + cron.w.join(",");

        let regexCronTime = /^\d{1,2}\s\d{1,2}\s\*\s\*\s(?:[0-6]?$|[0-6,]*$)/;

        if (!regexCronTime.test(begin) || !regexCronTime.test(end) ){
          console.log("Error in Downtime, either begin or end have wrong values: ",cron);
          console.log("Begin: " + begin);
          console.log("End  : " + end);
          continue;
        }

        console.log("Begin: " + begin);
        console.log("End  : " + end);

        let temp = schedule.scheduleJob(begin, ()=>{
          console.log("-------------------- DOWNTIME starts --------------------");
          this.isDowntime = true;
          this.informListener();
          this.downTimeEnds = ("0" + cron.endH).slice(-2) + ":" + ("0" + cron.endM).slice(-2) + " Uhr";
          //console.log("this.downTimeEnds",this.downTimeEnds);
        });
        this.downtimes.push(temp);
        temp = schedule.scheduleJob(end, ()=>{
          console.log("-------------------- DOWNTIME ends ----------------------");
          this.isDowntime = false;
          this.informListener();
          
        });
        this.downtimes.push(temp);

        // check if we are in a defined day
        if (cron.w.indexOf(now.getDay()) > -1){
          let beginDate = new Date(now.getFullYear(),now.getMonth(),now.getDate(),cron.beginH,cron.beginM);
          let endDate = new Date(now.getFullYear(),now.getMonth(),now.getDate(),cron.endH,cron.endM);
          if (beginDate < now && now < endDate){
            console.log("-------------------- DOWNTIME starts --------------------");
            this.isDowntime = true;
            this.informListener();
          }
        }
      } else {
        console.log("Error in Downtime: ",cron);
      }
    }
    
    console.log("DOWNTIME init done.");
  }
};

module.exports = Downtime;


