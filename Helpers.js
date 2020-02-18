'use strict'

module.exports = {
  isPatronId : function(patronId){
    return /^\d{1,11}$/.test(patronId)
  },
  isItemId : function(itemId){
    return /^[FDZ0-9]\d{7}[X0-9]$/.test(itemId);
  },
}