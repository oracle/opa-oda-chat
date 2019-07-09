/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* The Universal Permissive License (UPL), Version 1.0
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
