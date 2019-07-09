/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* The Universal Permissive License (UPL), Version 1.0
*/
var OpaInterviewSession = require('./OpaInterviewSession.js')

function OdaSessionManager (expirymins, bot, conversation) {
  const state = JSON.parse(conversation.variable('user.opacomponent.sessionstore') || '{}')
  var sm = {
    expirymins: expirymins || 30,
    conversation: conversation,
    sessions: rehydrate(state.sessions),
    bot: bot,
    previousInterview: state.currentInterview || null,
    currentInterview: null
  }

  sm.has = function (id) { return (id in sm.sessions) }

  sm.get = function (id) {
    // store the id of the currently used interview
    sm.currentInterview = id
    if (sm.sessions[id] && ((Date.now() - sm.sessions[id].lastUsed) < (expirymins * 60 * 1000))) {
      return sm.sessions[id]
    } else {
      sm.bot.logger.debug('Creating session for ' + id)
      sm.sessions[id] = new OpaInterviewSession(id)
      return sm.sessions[id]
    }
  }

  sm.destroy = function (id) {
    sm.bot.logger.info('Destroying session for ' + id)
    delete sm.sessions[id]
  }

  sm.cleanup = function () {
    for (var s in sm.sessions) {
      var session = sm.sessions[s]
      if ((Date.now() - session.lastUsed) > (sm.expirymins * 60 * 1000)) {
        if (bot.configuration.supportsAdhocMessages) {
          sm.bot.sayComments({ 'channel': s }, ['Sorry, I have to go now. ' + session.get('interviewConfig').farewell])
            .catch((e) => { sm.bot.logger.error('Error cleaning up session \'' + s + '\':' + e) })
        }
        sm.destroy(s)
      }
    }
  }

  sm.persist = function () {
    conversation.variable('user.opacomponent.sessionstore', JSON.stringify({ currentInterview: sm.currentInterview, sessions: sm.sessions }))
  }
  // setInterval(sm.cleanup, (60 * 1000)); // clean up sessions every minute
  return sm
}

module.exports = OdaSessionManager

function rehydrate (sessionData) {
  if (!sessionData) return {}
  const keys = Object.keys(sessionData)
  const sessions = {}
  for (const key of keys) {
    sessions[key] = new OpaInterviewSession(key, sessionData[key])
  }
  return sessions
}
