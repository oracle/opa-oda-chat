/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
module.exports = OpaSession

function OpaSession (id, data) {
  this.created = this.lastUsed = Date.now()
  this.id = id
  this.values = {}
  this.opaCookie = {}
  if (data) {
    this.created = data.created
    this.lastUsed = data.lastUsed
    this.values = data.values
    this.opaCookie = data.opaCookie
  }
}

OpaSession.prototype = {
  constructor: OpaSession,

  set: function (key, value) {
    this.values[key] = value
    this.lastUsed = Date.now()
    return this.values[key]
  },

  get: function (key) {
    this.lastUsed = Date.now()
    return this.values[key]
  }
}
