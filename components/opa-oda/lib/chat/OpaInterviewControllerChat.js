/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
var OpaInterviewScreen = require('./OpaInterviewScreenChat.js')
var querystring = require('querystring')
var moment = require('moment')
var chrono = require('chrono-node')
const https = require('https')
const url = require('url')

module.exports = OpaInterviewController

function OpaInterviewController (config, bot) {
  this.env = bot.configuration.env
  this.log = bot.logger
  // this.log.setLevel(env.LOG_LEVEL)
  this.url = config.interviewServiceURL
  this.chatUrl = config.chatUrl
  this.authUrl = config.authUrl
  this.chatClientId = config.chatClientId
  this.chatClientSecret = config.chatClientSecret
  this.seedData = config.seedData || undefined
  if (config.wscLoadParams) this.wscLoadParams = querystring.parse(config.wscLoadParams)

  this.sessionCookie = ''
  this.oAuthToken = ''
  this.utterances = config.utterances
}

OpaInterviewController.prototype = {
  constructor: OpaInterviewController,

  getFirstScreen: function (message, session, investigateFn, greetings) {
    var ic = this
    var firstScreen
    return new Promise(function (resolve, reject) {
      ic.getAuthToken(reject, ic.startSession, (firstScreenBody, headers) => {
        session.set('authToken', ic.oAuthToken)
        ic.log.debug('Started Chat API session.')
        ic.log.trace(JSON.stringify(firstScreenBody, null, 2))
        session.opaCookie = headers['set-cookie']

        session.set('investigateUrl', firstScreenBody.investigateUrl)
        firstScreen = new OpaInterviewScreen(firstScreenBody, ic.env, ic.log)
        if (greetings) firstScreen.setGreeting(greetings)
        resolve(investigateFn(session, ic, firstScreen, message))
      })
    })
  },

  getAuthToken: function (reject, startFn, doneFn) {
    var ic = this
    if (this.oAuthToken) {
      startFn.call(ic, reject, doneFn)
    } else {
      const parsedUrl = url.parse(ic.authUrl)
      const form = {
        grant_type: 'client_credentials',
        client_id: ic.chatClientId,
        client_secret: ic.chatClientSecret
      }
      const postData = querystring.stringify(form)
      const req = https.request({
        hostname: parsedUrl.host,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let body = ''
        res.on('data', data => {
          body += data
        })
        res.on('end', () => {
          ic.oAuthToken = JSON.parse(body)
          ic.log.debug('Got oAuth token')
          startFn.call(ic, reject, doneFn)
        })
      })
      req.on('error', (e) => {
        ic.log.error('Failed to get oAuth token')
        reject(e)
      })
      req.write(postData)
      req.end()
    }
  },

  startSession: function (reject, doneFn, chatUrlPath) {
    var ic = this
    var startBody = {}
    if (ic.seedData) startBody.seedData = JSON.parse(ic.seedData)
    if (ic.wscLoadParams) startBody.params = JSON.parse(ic.wscLoadParams)
    const parsedUrl = url.parse(ic.chatUrl)
    const req = https.request({
      hostname: parsedUrl.host,
      path: chatUrlPath || parsedUrl.pathname,
      method: 'POST',
      // auth: { bearer: ic.oAuthToken.access_token },
      headers: {
        'Authorization': 'Bearer ' + ic.oAuthToken.access_token
      }
    },
    (res) => {
      let body = ''
      res.on('data', data => {
        body += data
      })
      res.on('end', () => {
        if (res.statusCode === 307) {
          ic.startSession(reject, doneFn, res.headers.location)
        } else {
          doneFn.call(ic, JSON.parse(body), res.headers)
        }
      })
    })
    req.on('error', (e) => {
      ic.log.error('Failed to get first screen')
      reject(e)
    })
    req.write(JSON.stringify(startBody))
    req.end()
  },

  loadData: function (session) {
    throw new Error('Not implemented')
  },

  setSeedData: function (session, seedData, firstScreen) {
    throw new Error('Not implemented')
  },

  getNextScreen: function (screen, input, session, investigateFn, redirectUrlPath) {
    var ic = this
    ic.oAuthToken = session.get('authToken')
    return new Promise(function (resolve, reject) {
      var submitBody = {
        operation: 'submit',
        id: screen.firstInput.id,
        value: ic.convertDataType(input.text, screen.firstInput, ic.utterances)
      }
      ic.log.trace(JSON.stringify(submitBody, null, 2))
      const parsedUrl = url.parse(session.get('investigateUrl'))
      const req = https.request({
        hostname: parsedUrl.host,
        path: redirectUrlPath || parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + ic.oAuthToken.access_token,
          cookie: session.opaCookie.map(c => {
            const cParts = c.split(';')[0].split('=')
            return querystring.stringify({ [cParts[0]]: cParts[1] })
          }).join('; ')
        }
      },
      (res) => {
        let body = ''
        res.on('data', data => {
          body += data
        })
        res.on('end', () => {
          if (res.statusCode === 307) {
            resolve(ic.getNextScreen(screen, input, session, investigateFn, res.headers.location))
          } else {
            ic.log.trace(JSON.stringify(body, null, 2))
            resolve(
              investigateFn(
                session,
                ic,
                new OpaInterviewScreen(JSON.parse(body), ic.env, ic.log),
                input
              )
            )
          }
        })
      })
      req.on('error', (e) => {
        ic.log.error('Failed to get next screen')
        reject(e)
      })
      req.write(JSON.stringify(submitBody))
      req.end()
    })
  },

  getFile: function (fileId, fileType, session) {
  //   var ic = this
  //   return new Promise(function (resolve, reject) {
  //     soap.createClient(ic.wsdlUrl, { WSDL_CACHE: ic.wsdlCache }, function (
  //       err,
  //       client
  //     ) {
  //       if (!err) {
  //         ic.soapClient = client
  //         ic.soapClient.addHttpHeader(
  //           'Cookie',
  //           session.opaCookie[ic.wsdlUrl].cookies
  //         )
  //         if (ic.wsdlSecurity) ic.soapClient.setSecurity(ic.wsdlSecurity)
  //         ic.soapClient.GetFiles(
  //           { form: { attributes: { id: fileId, 'form-type': fileType } } },
  //           function (err, result, raw) {
  //             if (!err) {
  //               resolve(result.form.$value)
  //             } else {
  //               ic.log.error('Error getting file from Interview Service.')
  //               ic.log.error(raw)
  //               reject(raw)
  //             }
  //           }
  //         )
  //       } else {
  //         ic.log.error('Error creating SOAP client.')
  //         ic.log.error(err)
  //         reject(err)
  //       }
  //     })
  //   })
  },

  goBack: function (screen, input, session, investigateFn, redirectUrlPath) {
      var ic = this
      ic.oAuthToken = session.get('authToken')
      return new Promise(function (resolve, reject) {
        var undoBody = {
          operation: 'undo',
          position: screen.res.position -1
        }
        ic.log.trace(JSON.stringify(undoBody, null, 2))
        const parsedUrl = url.parse(session.get('investigateUrl'))
        const req = https.request({
          hostname: parsedUrl.host,
          path: redirectUrlPath || parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + ic.oAuthToken.access_token,
            cookie: session.opaCookie.map(c => {
              const cParts = c.split(';')[0].split('=')
              return querystring.stringify({ [cParts[0]]: cParts[1] })
            }).join('; ')
          }
        },
        (res) => {
          let body = ''
          res.on('data', data => {
            body += data
          })
          res.on('end', () => {
            if (res.statusCode === 307) {
              resolve(ic.goBack(screen, input, session, investigateFn, res.headers.location))
            } else {
              ic.log.trace(JSON.stringify(body, null, 2))
              resolve(
                investigateFn(
                  session,
                  ic,
                  new OpaInterviewScreen(JSON.parse(body), ic.env, ic.log),
                  input
                )
              )
            }
          })
        })
        req.on('error', (e) => {
          ic.log.error('Failed to get previous screen with undo')
          reject(e)
        })
        req.write(JSON.stringify(undoBody))
        req.end()
      })
    },

  convertDataType: function (input, control, utterances) {
    if (control.type === 'currency' || control.type === 'number') {
      return Number.isNaN(Number(input)) ? null : Number(input)
    }
    if (control.type === 'boolean' || control.kind === 'collect') {
      if (utterances.yes.test(input.toLowerCase())) return true
      else if (utterances.no.test(input.toLowerCase())) return false
      else return input
    }
    if (control.type === 'date') {
      // moment.locale(this.locale)
      // return moment(chrono.parseDate(input)).format('YYYY-MM-DD')
      const mapLocale = {
        'de-DE': 'de',
        'en-US': 'en',
        'en-GB': 'en_GB',
        'es-ES': 'es',
        'fr-FR': 'fr',
        'ja-JP': 'ja',
        de_DE: 'de',
        en_US: 'en',
        en_GB: 'en_GB',
        es_ES: 'es',
        fr_FR: 'fr',
        ja_JP: 'ja'
      }
      const localeChrono = chrono[mapLocale[this.locale] || 'en_GB']
      return moment(localeChrono.parseDate(input)).format('YYYY-MM-DD')
    }

    return input
  }

  //  getSnapshot: function (session) {
  //    var ic = this
  //    return new Promise(function (resolve, reject) {
  //      soap.createClientAsync(ic.wsdlUrl, { WSDL_CACHE: ic.wsdlCache })
  //      .then((client) => {
  //        ic.soapClient = client
  //        ic.soapClient.addHttpHeader('Cookie', session.opaCookie[ic.wsdlUrl].cookies)
  //        if (ic.wsdlSecurity) ic.soapClient.setSecurity(ic.wsdlSecurity)
  //        return ic.soapClient.SnapshotSessionAsync({'goal-state' : session.get('screen').goalState})
  //      })
  //      .then((result) => {
  //        resolve(result.snapshot)
  //      })
  //      .catch((e) => {
  //        ic.log.error('Error calling snapshot service: ' + e.stack)
  //        reject(e)
  //      })
  //    })
  //  },
  //
  //  restoreSession: function (snapshot, session) {
  //    var ic = this
  //    return new Promise(function (resolve, reject) {
  //      soap.createClient(ic.wsdlUrl, { WSDL_CACHE: ic.wsdlCache }, function (err, client) {
  //        if (!err) {
  //          ic.soapClient = client
  //          if (ic.wsdlSecurity) ic.soapClient.setSecurity(ic.wsdlSecurity)
  //          var restoreRequest =
  //            '<typ:restore-session-request>' +
  //            '<typ:snapshot>' + snapshot + '</typ:snapshot>' +
  //            '</typ:restore-session-request>'
  //          ic.soapClient.RestoreSession({_xml:restoreRequest}, function (err, result, raw) {
  //            if (!err) {
  //              session.opaCookie[ic.wsdlUrl] = new Cookie(ic.soapClient.lastResponseHeaders)
  //              result.opaInterviewScreen = new OpaInterviewScreen(result, raw)
  //              resolve(result)
  //            } else {
  //              reject(err)
  //            }
  //          })
  //        } else {
  //          reject(err)
  //        }
  //      })
  //    })
  //  }
}
