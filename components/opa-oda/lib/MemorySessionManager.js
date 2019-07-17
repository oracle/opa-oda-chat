/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
var OpaInterviewSession = require('./OpaInterviewSession.js')

function MemorySessionManager (expirymins, bot) {
  var msm = {
    expirymins: expirymins || 30,
    sessions: {},
    bot: bot
  }

  msm.has = function (id) {
    return id in msm.sessions
  }

  msm.get = function (id) {
    if (!msm.sessions[id]) {
      msm.bot.logger.info('Creating session for ' + id)
      msm.sessions[id] = new OpaInterviewSession(id)
    }
    return msm.sessions[id]
  }

  msm.destroy = function (id) {
    msm.bot.logger.info('Destroying session for ' + id)
    delete msm.sessions[id]
  }

  msm.cleanup = function () {
    for (var s in msm.sessions) {
      var session = msm.sessions[s]
      if (Date.now() - session.lastUsed > msm.expirymins * 60 * 1000) {
        if (bot.configuration.supportsAdhocMessages) {
          msm.bot
            .sayComments({ channel: s }, [
              'Sorry, I have to go now. ' +
                session.get('interviewConfig').farewell
            ])
            .catch(e => {
              msm.bot.logger.error('Error cleaning up session \'' + s + '\':' + e)
            })
        }
        msm.destroy(s)
      }
    }
  }

  // setInterval(msm.cleanup, (60 * 1000)); // clean up sessions every minute
  return msm
}
module.exports = MemorySessionManager
