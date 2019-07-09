/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* The Universal Permissive License (UPL), Version 1.0
*/
var IBOPABot = require('./lib/ib_opa_bot.js')
//var request = require("request").defaults({ encoding: null })
var OdaSessionManager = require('./lib/OdaSessionManager.js')
const Joi = require('joi')
const https = require('https')
var logger

var ibOpaBot = new IBOPABot({
  debug: false,
  supportsAdhocMessages: false,
  env: require('./config')
})

process.on('unhandledRejection', (err, p) => {
  console.log('An unhandledRejection occurred')
  console.log(`Rejected Promise: ${p}`)
  console.log(`Rejection: ${err.stack}`)
})

module.exports = {
  metadata: () => ({
    name: 'OpaInterview',
    properties: {
      botName: { type: 'string', required: true },
      chatURL: { type: 'string', required: true },
      authURL: { type: 'string', required: true },
      chatClientId: { type: 'string', required: true },
      chatClientSecret: { type: 'string', required: true },
      greeting: { type: 'string', required: false },
      instructions: { type: 'string', required: false },
      stopWords: { type: 'string', required: false },
      backWords: { type: 'string', required: false },
      backFail: { type: 'string', required: false },
      offerRestart: { type: 'string', required: false },
      offerContinue: { type: 'string', required: false },
      sorryContinue: { type: 'string', required: false },
      removeSnapshot: { type: 'string', required: false },
      farewell: { type: 'string', required: false },
      confirmInput: { type: 'string', required: false },
      didntUnderstand: { type: 'string', required: false },
      maxPrompts: { type: 'int', required: false },
      seedData: { type: 'string', required: false }
    },
    supportedActions: [
      'finished', // finished naturally
      'stopped', // aborted early
      'error', // internal error
      'cancel' // exceeded maxPrompts
    ]
  }),

  invoke: (conversation, done) => {
    ibOpaBot.logger = logger = conversation.logger()
    // a few essentials
    ibOpaBot.sessionManager = new OdaSessionManager(
      ibOpaBot.configuration.env.OPA_SESSION_TIMEOUT_MINS || 30,
      ibOpaBot,
      conversation
    )
    var message
    if (
      conversation.messagePayload().attachment &&
      ['image', 'file'].find(
        x => x === conversation.messagePayload().attachment.type.toLowerCase()
      )
    ) {
      

      /*const { url } = conversation.attachment();      
      request.get(`${url}`, function (error, response, body) {

        var replyMessage = "";
        if (!error && response.statusCode == 200) {
          var base64Val = new Buffer(body).toString('base64');
          replyMessage = base64Val;
          conversation.logger().info(replyMessage);
        } else {
          replyMessage = "Something wrong getting the picture with request.";
          conversation.logger().error(replyMessage);
        }
         conversation.text()= {"name": "Uploaded", "data": replyMessage }
      });*/

     

      // they sent an image or a file
      /*message =
        '__' +
        conversation.messagePayload().attachment.type +
        ': ' +
        conversation.messagePayload().attachment.url*/
        
      //PW hardcode the message for now
       message={"name": "Uploaded", "data":"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEBSURBVFhH7ZRNCsIwEIV7Da+jC0E9juLag+lJdKOeQFzoSt+TjoQaMpMfU4V+8C2SmXlJC23zz8zhuXXGjdqc4KP1yI3aHKBcYM+N2kygXGDMjT6QC/TG1y+wgFt4hXKYVc5wll9LEhvoC06RWVHwyTl4g0s4grFwZgXvkFlRb2IHOcTDc1lDZjHTzAVyKOXJuzCDWcw0wwFaiug834D27w/VTReQJlcX7d8fqsu+6wdaU7ULEF8TXysPYfiUGx1CdS37hakpEVO2qSkRU7apKRFTthRcBV/NohCqvQk1+WoWhVDNS7ep9FpFC8hdq2gBuWsVGSitGd9wCQcGfo2meQJUihUToDHCEgAAAABJRU5ErkJggg=="}
        
    } else if (conversation.messagePayload().location) {
      // they sent a location
      message =
        '__loc: ' +
        conversation.messagePayload().location.latitude +
        ',' +
        conversation.messagePayload().location.longitude
    } else {
      // it's a plain text message
      message = conversation.text()
    }

    const firstName = conversation.variable('profile.firstName')
    var user
    if (firstName) {
      user = { firstName: firstName }
    } else {
      user = conversation.request().message.channelConversation.userId
    }

    //  // special case for the bot test UI
    //  const isTest = conversation.request().message.channelConversation.type == 'test'
    //  const channel = (isTest)
    //    ? 'test' + conversation.request().message.channelConversation.botId
    //    : conversation.request().message.channelConversation.channelId
    //  const sessionId = (isTest)
    //    ? 'test' + conversation.request().message.channelConversation.botId
    //    : conversation.request().message.channelConversation.sessionId

    // const botId = conversation.request().message.channelConversation.botId
    // const sessionId = conversation.request().message.channelConversation
    //   .sessionId

    //  // register the channel if we haven't seen it before
    //  if (!(channel in ibOpaBot.channels)) {
    //    ibOpaBot.channels[channel] = {}
    //    logger.info('Registered new channel ' + channel + '. '
    //      + Object.keys(ibOpaBot.channels).length + ' channels registered.')
    //  }

    // try to decrypt params
    var des = []
    const decrypted =
    [ { name: 'chatClientId', value: conversation.properties().chatClientId },
      { name: 'chatClientSecret', value: conversation.properties().chatClientSecret }
    ].reduce((acc, param) => {
      try {
        if (param.value) acc[param.name] = decrypt(param.value)
      } catch (e) {
        des.push(`Error decrypting '${param.name}': ${e}.`)
      } finally {
        return acc
      }
    }, {})
    if (des.length > 0) {
      des.map(err => conversation.reply(err))
      conversation.reply('Exiting.')
      // conversation.transition('error')
      // conversation.error(true)
      done(conversation)
      return
    }

    var interviewConfig = {
      botName: conversation.properties().botName,
      chatUrl: conversation.properties().chatURL || undefined,
      authUrl: conversation.properties().authURL || undefined,
      chatClientId: decrypted.chatClientId || undefined,
      chatClientSecret: decrypted.chatClientSecret || undefined,
      greeting: conversation.properties().greeting || undefined,
      instructions: conversation.properties().instructions || undefined,
      stopWords: conversation.properties().stopWord || 'stop',
      backWords: conversation.properties().backWord || 'back',
      trueWord: conversation.properties().trueWord || 'Yes',
      falseWord: conversation.properties().falseWord || 'No',
      backFail:
        conversation.properties().backFail || 'You can\'t go back from here.',
      offerRestart: conversation.properties().offerRestart || undefined,
      offerContinue:
        conversation.properties().offerContinue ||
        'Would you like to continue from where you left off last time?',
      sorryContinue:
        conversation.properties().sorryContinue ||
        'Sorry, something went wrong. We need to restart.',
      removeSnapshot: conversation.properties().removeSnapshot || false,
      farewell: conversation.properties().farewell || undefined,
      confirmInput:
        conversation.properties().confirmInput || 'Did you mean \'{input}\'?',
      didntUnderstand:
        conversation.properties().didntUnderstand ||
        'Sorry, I didn\'t understand that.',
      maxPrompts: conversation.properties().maxPrompts || undefined,
      seedData: conversation.properties().seedData || undefined
    }

    const validate = Joi.object({
      botName: Joi.string().required(),
      chatUrl: Joi.string().required(),
      authUrl: Joi.string().required(),
      chatClientId: Joi.string().required(),
      chatClientSecret: Joi.string().required(),
      greeting: Joi.string().optional(),
      instructions: Joi.string().optional(),
      stopWords: Joi.string().optional(),
      backWords: Joi.string().optional(),
      trueWord: Joi.string().optional(),
      falseWord: Joi.string().optional(),
      backFail: Joi.string().optional(),
      offerRestart: Joi.string().optional(),
      offerContinue: Joi.string().optional(),
      sorryContinue: Joi.string().optional(),
      removeSnapshot: Joi.boolean().optional(),
      farewell: Joi.string().optional(),
      confirmInput: Joi.string().optional(),
      didntUnderstand: Joi.string().optional(),
      maxPrompts: Joi.number()
        .integer()
        .optional(),
      seedData: Joi.string().optional()
    }).validate(interviewConfig)
    if (validate.error != null) {
      conversation.reply('Invalid config. ' + validate.error.message)
      // conversation.transition('error')
      // conversation.error(true)
      done(conversation)
      return
    }

    var say = function (message, cb) {
      // delete message.channel
      conversation.reply(message)
      cb()
    }
    logger.debug('OpaInterview: message = ' + message)

    const msg = {
      text: message,
      user: user,
      // 'channel': channel,
      sessionId: interviewConfig.chatUrl, // (botId + '_' + sessionId),
      interviewConfig: interviewConfig
    }

    ibOpaBot
      .handleMessage(msg, say)
      .then((result) => {
        logger.debug('handleMessage result: ' + result)
        if (
          result &&
          (result === 'finished' || result === 'stopped' || result === 'cancel')
        ) {
          logger.debug('Transitioning to ' + result)
          conversation.transition(result)
          // conversation.keepTurn(true)
        }
        ibOpaBot.sessionManager.persist()
        done()
        // done(conversation)
      })
      .catch(e => {
        //  ibOpaBot.removeSnapshot(ibOpaBot.sessionManager.get(channel + '_' + sessionId), msg)
        ibOpaBot.logger.error(
          'Error handling message: ' + JSON.stringify(e, null, null, 2)
        )
        conversation.reply(e)
        // conversation.transition('error')
        // conversation.error(true)
        // conversation.keepTurn(true)
        done()
        // done(conversation)
      })
  }
}

function decrypt (input) {
  if (input === undefined) return input
  var decipher = require('crypto').createDecipheriv(
    'aes-256-cbc',
    ibOpaBot.configuration.env.CRYPTO_SECRET,
    ibOpaBot.configuration.env.CRYPTO_IV
  )
  decipher.setAutoPadding(true)
  var dec = decipher.update(input, 'base64', 'utf8')
  dec += decipher.final('utf8')
  return dec
}
