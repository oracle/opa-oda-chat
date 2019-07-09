/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* The Universal Permissive License (UPL), Version 1.0
*/
var OpaInterviewController = require('./OpaInterviewController.js')
var OpaInterviewScreen = require('./OpaInterviewScreen.js')
// var MemorySessionManager = require('./MemorySessionManager.js')
var ss = require('string-similarity')

const InterviewState = {
  OFFER_RESTORE: 'offerrestore',
  // RESTORING: 'restoring',
  STARTING: 'starting',
  QUESTION: 'question',
  WINDUP: 'windup',
  STOP: 'stopped',
  CANCEL: 'cancel',
  ESCALATE: 'escalate',
  CONFIRM: 'confirm',
  FINISHED: 'finished'
}

function CoreOpaBot (configuration) {
  var cob = {
    configuration: configuration || {},
    logger: null, // passed in after creation
    utterances: {
      yes: new RegExp(/^(true|yes|yea|yup|yep|ya|sure|ok|y|yeah|yah)/i),
      no: new RegExp(/^(false|no|nah|nope|n)/i),
      quit: new RegExp(/^(quit|cancel|end|stop|nevermind|never mind)/i)
    }
  }
  // cob.logger.setLevel(cob.LOG_LEVEL)
  // cob.sessionManager = new MemorySessionManager(cob.OPA_SESSION_TIMEOUT_MINS || 30, cob)

  cob.handleMessage = function (message, sayFn) {
    return new Promise(function (resolve, reject) {
      cob.sayFn = sayFn

      cob.logger.debug('hadSession: ' + cob.hasSession(message.sessionId))
      var session = cob.sessionManager.get(message.sessionId) // get or create session
      if (
        session.get('state') === undefined ||
        session.get('state') === InterviewState.FINISHED ||
        session.get('state') === InterviewState.STOP
      ) {
        session.set('state', InterviewState.STARTING)
      }
      cob.logger.trace('session state: ' + session.get('state'))
      //  if (!session.get('snapshots')) session.set('snapshots', {})
      //  var snapshot = session.get('snapshots')[message.interviewConfig.interviewServiceWSDL]
      //  cob.logger.debug('hasSnapshot: ' + (typeof snapshot === 'object'))
      const changedInterview =
        cob.sessionManager.previousInterview !== null &&
        cob.sessionManager.currentInterview !==
          cob.sessionManager.previousInterview
      cob.logger.debug('changedInterview: ' + changedInterview)

      // stop the conversation?
      if (
        cob.hears_regexp(
          message.interviewConfig.stopWords
            .split(',')
            .map(w => '\\b' + w + '\\b'),
          message
        )
      ) {
        cob.logger.debug('Stop word heard in \'' + message.text + '\'')
        session.set('state', InterviewState.STOP)
        resolve(cob.endImmediately(message, session))
        return
      }

      // if (snapshot && (session.get('state') !=== InterviewState.FINISHED)) {
      if (session.get('state') !== InterviewState.STARTING) {
        // an interview is already in progress
        // restore previously saved interview snapshot?
        // const minsAway = (Date.now() - session.lastUsed) / 1000 / 60
        //  cob.logger.debug('minsAway: ' + minsAway)
        const canRestore =
          changedInterview ||
          // NOT YET - NEED RESTORE ENDPOINT IN CHAT API TO SUPPORT RESTORING FROM CHECKPOINT
          // || (minsAway >= cob.OPA_SESSION_TIMEOUT_MINS)
          session.get('state') === InterviewState.OFFER_RESTORE
        // NOT YET - NEED RESTORE ENDPOINT IN CHAT API TO SUPPORT RESTORING FROM CHECKPOINT
        //  || (session.get('state') == InterviewState.STOP))
        cob.logger.debug('canRestore: ' + canRestore)

        cob
          .checkRestore(message, session, canRestore)
          .then(restore => {
            cob.logger.debug('Restoring: ' + restore)
            if (restore === 'n/a') return cob.continueInterview(message)
            if (restore === 'no') return cob.startInterview(message)
            else if (restore === 'asking') return Promise.resolve(restore)
            else {
              var interviewConfig = message.interviewConfig
              interviewConfig.utterances = cob.utterances
              var ic = new OpaInterviewController(
                interviewConfig,
                cob
              )
              var screenData = session.get('screen')
              var screen = new OpaInterviewScreen(
                screenData.res,
                screenData.env,
                ic.log
              )

              return cob.doQuestion(screen, message, session, ic, [], [])
              // return cob.continueInterview(message)
            }
          })
          //  .then((result) => Promise.all(
          //    [ resolve(result),
          //      cob.snapshotSession(message)]
          //  ))
          //  .catch((e) => {
          //    reject(e)
          //  })

          // cob.continueInterview(message)
          .then(result => resolve(result))
          .catch(e => {
            cob.logger.error('Error continuing interview: ' + e)
            reject(e)
          })
      } else {
        // we're starting a new interview
        cob
          .startInterview(message)
          .then(result => resolve(result))
          .catch(e => {
            cob.logger.error('Error starting interview: ' + e)
            reject(e)
          })
      }
    })
  }

  cob.startInterview = function (message) {
    return new Promise(function (resolve, reject) {
      var session = cob.sessionManager.get(message.sessionId)

      var interviewConfig = message.interviewConfig
      interviewConfig.utterances = cob.utterances
      // interviewConfig.wsdlCache = cob.wsdlCache
      var ic = new OpaInterviewController(
        interviewConfig,
        cob
      )
      // session.set('interviewController', ic)
      session.set('interviewConfig', interviewConfig)
      session.set('state', 'starting')
      session.set('messages', [])
      //  cob.removeSnapshot(session, message)

      cob
        .getUserProfile(message.user, message.pageToken)
        .then((userProfile) => {
          // cob.logger.info(`User '${message.user.}' starting chat with bot '${interviewConfig.botName}'`)
          var name =
            interviewConfig &&
            interviewConfig.osvc &&
            interviewConfig.osvc.defaultContactName
              ? ' ' + interviewConfig.osvc.defaultContactName
              : userProfile && userProfile.first_name
                ? ' ' + userProfile.first_name
                : ''
          var greetings = []
          if (interviewConfig.greeting) {
            greetings.push(interviewConfig.greeting.replace('{user}', name))
          }
          if (interviewConfig.instructions) {
            greetings.push(
              interviewConfig.instructions.replace('{user}', name)
            )
          }
          return ic.getFirstScreen(
            message,
            session,
            cob.investigate,
            greetings
          )
        })
        .then(result => resolve(result))
        .catch(e => {
          cob.logger.error('Error starting interview: ' + e)
          //  cob.removeSnapshot(session, message)
          reject(e)
        })
    })
  }

  cob.investigate = function (session, ic, screen, message) {
    return new Promise(function (resolve, reject) {
      cob.logger.debug('inside investigate')
      if (!screen) {
        reject(new Error('No screen provided to Investigate'))
        return
      }
      Promise.all([
        cob.doWarningsAndErrors(screen),
        cob.doLabels(screen, session, ic)
      ])
        .then(returnVals =>
          cob.doQuestion(
            screen,
            message,
            session,
            ic,
            returnVals[0],
            returnVals[1]
          )
        )
        .then(result => resolve(result))
        .catch(e => {
          cob.logger.error('Error rendering screen: ' + e.stack)
          //  cob.removeSnapshot(session, message)
        })
    })
  }

  cob.doWarningsAndErrors = function (screen) {
    return new Promise(function (resolve, reject) {
      resolve(screen.warningControls.concat(screen.errorControls))
    })
  }

  cob.doLabels = function (screen, session, ic) {
    return new Promise(function (resolve, reject) {
      if (screen.labelControls.length) {
        const labelsP = screen.labelControls
          .filter(l => l.kind !== 'screen' && l.kind !== 'end') // ignore screen and 'end' labels
          .map(l => cob.embelishLabelP(l, session, ic))
        Promise.all(labelsP)
          .then(lbls => {
            resolve(lbls)
          })
          .catch(e => {
            cob.logger.error(e)
            resolve(['Sorry, I can\'t get to that information right now.'])
          })
      } else {
        resolve([])
      }
    })
  }

  cob.doQuestion = function (
    screen,
    message,
    session,
    ic,
    warningsAndErrors,
    labels
  ) {
    return new Promise(function (resolve, reject) {
      cob.logger.debug('inside doQuestion')

      // if there were warnings, errors or labels generated, queue them up before the question
      var comments = cob
        .formatLabels(screen.greetings)
        .concat(cob.formatLabels(warningsAndErrors))
        .concat(cob.formatLabels(labels))
        .reduce((acc, val) => {
          return acc.concat(val)
        }, [])

      // add the question or offer to restart to the list of things to say
      if (screen.hasQuestion()) {
        var opts = screen.getQuestionOptions(message.interviewConfig)
        var question = cob.formatQuestion(screen.getQuestion(), opts)

        session.set('state', 'question')
        session.set('question', { options: opts })
        session.set('screen', screen)

        comments.push(question)
      } else {
        // wind up. Offer to restart, or just finish.
        if (message.interviewConfig.offerRestart) {
          var q = cob.getConfirmQuestion(
            message.interviewConfig.offerRestart,
            message.interviewConfig.trueWord,
            message.interviewConfig.falseWord
          )
          session.set('state', 'windup')
          comments.push(q)
        } else {
          //  cob.removeSnapshot(session, message)
          session.set('state', InterviewState.FINISHED)
        }
      }

      // say labels, explanations, etc
      cob
        .sayComments(message, comments, session)
        .then(() => {
          resolve(session.get('state'))
        })
        .catch(e => reject(e))
    })
  }

  cob.hasSession = function (id) {
    return cob.sessionManager.has(id)
  }

  cob.continueInterview = function (message) {
    return new Promise(function (resolve, reject) {
      var session = cob.sessionManager.get(message.sessionId)
      // cob.logger.debug('session state = ' + session.get('state'))
      session.set(
        'messages',
        session
          .get('messages')
          .concat({ from: 'Customer', message: message.text })
      )

      var interviewConfig = message.interviewConfig
      interviewConfig.utterances = cob.utterances
      var ic = new OpaInterviewController(
        interviewConfig,
        cob
      )

      var screenData = session.get('screen')
      var screen = new OpaInterviewScreen(screenData.res, screenData.env, ic.log)

      if (
        session.get('state') === InterviewState.CANCEL ||
        session.get('state') === InterviewState.STOP
      ) {
        // was previously canceled, ask previous question again
        resolve(cob.investigate(session, ic, screen, message))
        return
      }

      if (session.get('state') === 'confirm') {
        if (cob.isAffirmative(message, cob.utterances)) {
          message.text = session.get('confirmInput')
          resolve(ic.getNextScreen(screen, message, session, cob.investigate))
        } else {
          // ask again
          resolve(cob.investigate(session, ic, screen, message))
        }
        return
      }

      if (
        cob.hears_regexp(
          message.interviewConfig.backWords
            .split(',')
            .map(w => '\\b' + w + '\\b'),
          message
        )
      ) {
        if (screen.previousGoalState) {
          resolve(ic.goBack(screen, message, session, cob.investigate))
        } else {
          screen.setGreeting([message.interviewConfig.backFail])
          resolve(cob.investigate(session, ic, screen, message))
        }
        return
      }

      if (session.get('state') === 'question') {
        var opts = session.get('question').options
        var input = ic.convertDataType(
          message.text,
          screen.firstInput,
          message.interviewConfig.utterances
        )
        //PW really crap but test to see if attachment message by checking length, eventually this could be a check that it is an attach
        //ment control
        if (input.length > 300){
          resolve(
            ic.getNextScreen(screen, message, session, cob.investigate)
          )
          return
        }



        if (!opts || !opts.length) {
          if (input) {
            resolve(
              ic.getNextScreen(screen, message, session, cob.investigate)
            )
            return
          }
        } else {
          input = cob.exactIndexMatch(message.text, opts)
          if (input) {
            if (input) message.text = input.value
            resolve(
              ic.getNextScreen(screen, message, session, cob.investigate)
            )
            return
          }
          input = cob.exactValueMatch(message.text, opts)
          if (input) {
            message.text = input.value
            resolve(
              ic.getNextScreen(screen, message, session, cob.investigate)
            )
            return
          }
          input = cob.exactCaptionMatch(message.text, opts)
          if (input) {
            message.text = input.value
            resolve(
              ic.getNextScreen(screen, message, session, cob.investigate)
            )
            return
          }
        }
        // if using maxPrompts then require exact input
        const maxPrompts = message.interviewConfig.maxPrompts || 0
          if (!input && maxPrompts > 0) {
          session.set('failedPrompts', (session.get('failedPrompts') || 0) + 1)
          if (session.get('failedPrompts') === maxPrompts) {
            cob.logger.info('maxPrompts exceeded. Exiting.')
            session.set('failedPrompts', 0)
            session.set('state', InterviewState.CANCEL)
            //  if (message.interviewConfig.removeSnapshot) {
            //    cob.removeSnapshot(session, message)
            //  } else {
            //    cob.snapshotSession(message)
            //  }
            resolve(InterviewState.CANCEL)
          } else {
            cob
              .sayComments(
                message,
                [message.interviewConfig.didntUnderstand],
                session
              )
              .then(function () {
                // ask again
                resolve(cob.investigate(session, ic, screen, message))
              })
          }
          return
        }

        var similarity = cob.similarityMatch(message.text, opts)
        var origResponse = message
        if (!similarity.confirm) {
          origResponse.text = similarity.input.value
          resolve(
            ic.getNextScreen(screen, origResponse, session, cob.investigate)
          )
          return
        } else {
          cob.logger.debug('input requries confirmation')
          session.set('state', 'confirm')
          session.set('confirmInput', similarity.input.text)
          var confirmQuestion = message.interviewConfig.confirmInput.replace(
            '{input}',
            similarity.input.text
          )
          resolve(
            cob.sayComments(
              message,
              [
                cob.getConfirmQuestion(
                  confirmQuestion,
                  message.interviewConfig.trueWord,
                  message.interviewConfig.falseWord
                )
              ],
              session
            )
          )
          return
        }
      }

      if (session.get('state') === 'windup') {
        if (
          message.interviewConfig.offerRestart &&
          cob.isAffirmative(message, cob.utterances)
        ) {
          // var interviewConfig = message.interviewConfig
          // interviewConfig.utterances = cob.utterances
          // interviewConfig.wsdlCache = cob.wsdlCache
          // var newic = new OpaInterviewController(
          //   interviewConfig,
          //   cob
          // )
          // session.set('interviewController', newic)
          resolve(ic.getFirstScreen(message, session, cob.investigate, []))
        } else {
          // say goodbye, or just go quietly
          session.set('state', InterviewState.FINISHED)
          if (message.interviewConfig.farewell) {
            cob
              .sayComments(message, [message.interviewConfig.farewell], session)
              .then(function () {
                //  cob.removeSnapshot(session, message)
                resolve('finished')
              })
          } else {
            //  cob.removeSnapshot(session, message)
            resolve('finished')
          }
        }
      }
    })
  }

  cob.checkRestore = (message, session, canRestore) => {
    return new Promise(function (resolve, reject) {
      if (!canRestore) {
        resolve('n/a')
        return
      }
      if (session.get('state') === InterviewState.OFFER_RESTORE) {
        const doRestore = cob.isAffirmative(message, cob.utterances)
          ? 'yes'
          : 'no'
        resolve(doRestore)
      } else {
        const offerMsg = message.interviewConfig.offerContinue
        if (offerMsg && offerMsg.length > 0) {
          cob
            .sayComments(
              message,
              [
                cob.getConfirmQuestion(
                  message.interviewConfig.offerContinue,
                  message.interviewConfig.trueWord,
                  message.interviewConfig.falseWord
                )
              ],
              session
            )
            .then(() => {
              session.set('state', InterviewState.OFFER_RESTORE)
              resolve('asking')
            })
        } else {
          resolve('yes')
        }
      }
    })
  }

  //  cob.snapshotSession = function (message) {
  //    return new Promise(function (resolve, reject) {
  //      if (!cob.hasSession(message.sessionId)) {
  //        cob.logger.debug('Not snapshotting, no session')
  //        resolve() return
  //      }
  //      var session = cob.sessionManager.get(message.sessionId)
  //      if ((session.get('state') == InterviewState.OFFER_RESTORE)) {
  //        cob.logger.debug('Not snapshotting, offering restore.')
  //        resolve() return
  //      }
  //      if ((session.get('state') == InterviewState.FINISHED)) {
  //        cob.logger.debug('Not snapshotting, finished.')
  //        resolve() return
  //      }
  //      var config = message.interviewConfig
  //      var ic = session.get('interviewController')
  //      ic.getSnapshot(session)
  //      .then((snapshot) => {
  //        session.get('snapshots')[config.interviewServiceWSDL] = { timestamp: moment(), snapshot: snapshot }
  //        cob.logger.debug('Snapshotted session: user ' + session.user + ' for ' + config.interviewServiceWSDL)
  //        cob.logger.debug('Current snapshots:')
  //        cob.logger.debug(JSON.stringify(session.get('snapshots'), null, 2))
  //        resolve()
  //      })
  //      .catch(e => {
  //        cob.logger.error('Couldn\'t snapshot session: ' + e)
  //        reject(e)
  //      })
  //    })
  //  }
  //
  //  cob.removeSnapshot = function (session, message) {
  //    if (session.get('snapshots').hasOwnProperty(message.interviewConfig.interviewServiceWSDL)) {
  //      delete session.get('snapshots')[message.interviewConfig.interviewServiceWSDL]
  //      cob.logger.debug('Deleted snapshot: user ' + session.user + ' for ' + message.interviewConfig.interviewServiceWSDL)
  //    }
  //  }
  //
  //  cob.restoreSession = (message, session, snapshot, restore) => {
  //    var interviewConfig = message.interviewConfig
  //    interviewConfig.utterances = cob.utterances
  //    interviewConfig.wsdlCache = cob.wsdlCache
  //    var ic = new OpaInterviewController(interviewConfig)
  //    session.set('interviewController', ic)
  //    session.set('interviewConfig', interviewConfig)
  //    session.set('messages', [])
  //    return new Promise(function (resolve, reject) {
  //      if (restore == 'n_a' || restore == 'no' || restore == 'asking') {
  //        resolve({status: restore})
  //        return
  //      }
  //      ic.restoreSession(snapshot.snapshot, session)
  //      .then((result) => {
  //        session.set('state', InterviewState.RESTORING)
  //        resolve({status: 'ok', result: result})
  //      })
  //      .catch(e => {
  //        console.log.error('Couldn\'t restore session: ' + e)
  //        cob.sayComments(message, [message.interviewConfig.sorryContinue], session)
  //        .then(() => {
  //          reject({status: 'error'})
  //        })
  //      })
  //    })
  //  }

  // default label formatter for bots that don't need additional formatting of labels
  cob.formatLabels = function (labels) {
    return labels
  }

  cob.formatPlainQuestion = function (question, opts) {
    var xs = [question.text].concat(
      (opts || []).map(x => x.index + ' ) ' + x.text)
    )
    var ys = xs.reduce(function (acc, val) {
      var last = acc[acc.length - 1]
      if (last && last.length + val.length < 600) {
        acc[acc.length - 1] = last + '\n' + val
      } else {
        acc.push(val)
      }
      return acc
    }, [])
    return ys
  }

  cob.sayComments = function (message, comments, session) {
    return new Promise(function (resolve, reject) {
      if (!comments) resolve()
      comments
        .map(c => {
          var m = typeof c === 'string' ? { text: c } : c
          // m.channel = message.channel
          return m
        })
        .reduce((prev, c) => {
          return prev.then(() => {
            return cob.sayComment(c, session)
          })
        }, Promise.resolve())
        .then(resolve)
        .catch(e => {
          cob.logger.error('Error saying comments: ' + e)
        })
    })
  }
  cob.sayComment = function (message, session) {
    return new Promise(function (resolve, reject) {
      cob.sayFn(message, () => {
        cob.logger.debug('Said ' + JSON.stringify(message))
        session.set(
          'messages',
          session.get('messages').concat({ from: 'Bot', message: message.text })
        )
        resolve()
      })
    })
  }

  cob.endImmediately = function (message, session) {
    return new Promise(function (resolve, reject) {
      var comments = []
      if (message.interviewConfig.farewell) comments.push(message.interviewConfig.farewell)
      cob.sayComments(message, comments, session).then(function () {
        //  if (message.interviewConfig.removeSnapshot) cob.removeSnapshot(session, message)
        resolve('stopped')
      })
    })
  }

  cob.exactIndexMatch = function (x, ys) {
    return ys.find(y => y.index === x)
  }
  cob.exactValueMatch = function (x, ys) {
    return ys.find(y => y.value === x.toLowerCase())
  }
  cob.exactCaptionMatch = function (x, ys) {
    // if there's one option containing the exact whole input, use it
    var reWhole = new RegExp('^' + x.toLowerCase() + '$')
    var os = ys.filter(y => reWhole.test(y.text.toLowerCase()))
    // otherwise if there's one option containing an exact phrase match, use it
    if (os.length === 0) {
      var rePhrase = new RegExp('\\b' + x.toLowerCase() + '\\b')
      os = ys.filter(y => rePhrase.test(y.text.toLowerCase()))
    }
    if (os.length === 1) {
      return os[0]
    } else {
      return undefined
    }
  }
  cob.similarityMatch = function (x, ys) {
    var matches = ss.findBestMatch(x, ys.map(y => y.text))
    var best = matches.bestMatch.target
    var sortedMatches = matches.ratings
      .sort((a, b) => a.rating - b.rating)
      .reverse()
    const first = sortedMatches[0]
    const second = sortedMatches[1]
    var requiresConfirmation =
      second && (second.rating > 0 && first.rating / second.rating < 2)
    return {
      input: ys.find(y => y.text === best),
      confirm: requiresConfirmation
    }
  }
  cob.isAffirmative = function (msg, utterances) {
    return (
      utterances.yes.test(msg.text) ||
      msg.text.toLowerCase() === msg.interviewConfig.trueWord.toLowerCase()
    ) // (['yes', 'y', 'yep']).find(a => a.toLowerCase() == x.toLowerCase())
  }

  // cob.serveImages = function (opts) {
  //   // calculate the md5 and serve the image dynamically
  //   opts.forEach(function (o) {
  //     if (o['checked-image'] && o['checked-image'].data) {
  //       o['checked-image-url'] = cob.serveImage(o['checked-image'].data)
  //     }
  //     if (o['unchecked-image'] && o['unchecked-image'].data) {
  //       o['unchecked-image-url'] = cob.serveImage(o['unchecked-image'].data)
  //     }
  //   })
  // }

  //  cob.serveImage = function (data) {
  //    var md5sum = md5(data)
  //    var buf = new Buffer(data, 'base64')
  //    var fileInfo = fileType(buf)
  //    if (!((md5sum + '.' + fileInfo.ext) in cob.images)) {
  //      cob.images[md5sum + '.' + fileInfo.ext] = { 'mime-type': fileInfo.mime, 'data': buf }
  //    }
  //    return process.env.BOT_BASE_URL + '/dynimg/' + md5sum + '.' + fileInfo.ext
  //  }
  //
  //  cob.serveFile = function (data, user, filename) {
  //    var buf = new Buffer(data, 'base64')
  //    var key = String(user)
  //    var fileInfo = fileType(buf)
  //    filename = filename.replace(/\s/ig, '_')
  //    var session = cob.sessionManager.get(user)
  //    var files = session.get('files') || session.set('files', {})
  //    if (!(key in files)) files[key] = {}
  //    if (!((filename + '.' + fileInfo.ext) in files[key])) {
  //      files[key][filename + '.' + fileInfo.ext] = { 'mime-type': fileInfo.mime, 'data': buf }
  //    }
  //    return(process.env.BOT_BASE_URL + '/files/' + user + '/' + filename + '.' + fileInfo.ext)
  //  }

  cob.getConfirmQuestion = function (text) {
    return text
  }

  cob.hears_regexp = function (tests, message) {
    for (var t = 0; t < tests.length; t++) {
      if (message.text) {
        //  the pattern might be a string to match (including regular expression syntax)
        //  or it might be a prebuilt regular expression
        var test = null
        if (typeof tests[t] === 'string') {
          try {
            test = new RegExp(tests[t], 'i')
          } catch (err) {
            cob.logger.error(
              'Error in regular expression: ' + tests[t] + ': ' + err
            )
            return false
          }
          if (!test) {
            return false
          }
        } else {
          test = tests[t]
        }

        //PW crapness
        if (message.text.data)
          return false


        const match = message.text.match(test)
        if (match) {
          message.match = match
          return true
        }
      }
    }
    return false
  }

  return cob
}
module.exports = CoreOpaBot
