/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
module.exports = function (config, env) {
  // if (process.env.USE_SOAP_API == 'true') {
  //   var icSoap = require('./soap/OpaInterviewControllerSoap.js')
  //   return new icSoap(config)
  // } else {
  var IcChat = require('./chat/OpaInterviewControllerChat.js')
  return new IcChat(config, env)
  // }
}
