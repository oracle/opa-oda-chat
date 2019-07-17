/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
module.exports = function (result, raw) {
  // if (process.env.USE_SOAP_API == 'true') {
  //   var isSoap = require('./soap/OpaInterviewScreenSoap.js')
  //   return new isSoap(result, raw)
  // } else {
  var IsChat = require('./chat/OpaInterviewScreenChat.js')
  return new IsChat(result, raw)
  // }
}
