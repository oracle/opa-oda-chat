/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
var CoreOpaBot = require('./core_opa_bot.js')
const https = require('https')
const url = require('url')
var querystring = require('querystring')
// var fileType = require('file-type')

const MessageModel = require('@oracle/bots-node-sdk/lib/message/messageModel').MessageModel

function IBOPABot (configuration) {
  var ibBot = CoreOpaBot(configuration)
  ibBot.images = {}
  //  ibBot.channels = {}

  //  ibBot.startBot = function (webserver, port) {
  //  // set up dynamic image hosting
  //    webserver.get('/dynimg/:md5sum', function (req, res) {
  //      var md5sum = req.params.md5sum
  //      if (ibBot.images[md5sum]) {
  //        res.set('Content-Type', ibBot.images[md5sum]['mime-type'])
  //        res.end(ibBot.images[md5sum].data)
  //      } else {
  //        res.status(404).end()
  //      }
  //    })
  //    webserver.get('/files/:user/:filename', function (req, res) {
  //      var key = req.params.user
  //      var filename = req.params.filename
  //      var session = ibBot.sessionManager.get(key)
  //      var file = session.get('files')[key][filename]
  //      if (file) {
  //        res.set('Content-Type', file['mime-type'])
  //        res.end(file.data)
  //      } else {
  //        res.status(404).end()
  //      }
  //    })
  //
  //  }

  //  ibBot.getDynamicImage = function (md5sum) {
  //    return ibBot.images[md5sum]
  //  }
  //  ibBot.getFileForUser = function (user, filename) {
  //    var key = req.params.user
  //    var filename = req.params.filename
  //    var session = ibBot.sessionManager.get(key)
  //    return session.get('files')[key][filename]
  //  }

  ibBot.getUserProfile = function (user) {
    return new Promise(function (resolve, reject) {
      resolve({ first_name: user.firstName })
    })
  }

  ibBot.embelishLabelP = function (label, session, ic) {
    return new Promise(function (resolve, reject) {
      var text = label.text
      if (label.kind === 'image') {
        //resolve('Images are not currently supported.')
        //return
         if (label.url) {
           resolve(
             MessageModel.attachmentConversationMessage( 
               'image', label.url
             )
            ) 
             }
          return
        // } else {
        //   const parsedUrl = url.parse(label.url)
        //   const req = https.request({
        //     hostname: parsedUrl.host,
        //     path: parsedUrl.pathname,
        //     method: 'POST',
        //     headers: {
        //       'Authorization': 'Bearer ' + ic.oAuthToken.access_token,
        //       cookie: session.opaCookie.map(c => {
        //         const cParts = c.split(';')[0].split('=')
        //         return querystring.stringify({ [cParts[0]]: cParts[1] })
        //       }).join('; ')
        //     }
        //   },
        //   (res) => {
        //     let body = ''
        //     res.on('data', data => {
        //       body += data
        //     })
        //     res.on('end', () => {
        //       var buf = Buffer.from(body, 'base64')
        //       var fileInfo = fileType(buf)
        //       ibBot.images[label.url] = { 'mime-type': fileInfo.mime, 'data': buf }
        //       resolve(
        //         MessageModel.attachmentConversationMessage(
        //           'image',
        //           ibBot.images[label.url]['mime-type'] + ';base64, ' + ibBot.images[label.url].data
        //         )
        //       )
        //     })
        //   })
        //   req.on('error', (e) => {
        //     ic.log.error('Failed to get image.')
        //     reject(e)
        //   })
        //   req.end()
        // }
        // return
      }
      // or it might be a generated form
      if (label.kind === 'form') {
        resolve('Forms are not currently supported.')
        return
        // // get the document and serve it up
        // //  ic.getFile($label.attr('form-id'), $label.attr('form-type'), session)
        // //  .then(function (data) {
        // // var formURL = ibBot.serveFile(data, session.user, $label.attr('caption'))
        // const parsedUrl = url.parse(label.url)
        // const req = https.request({
        //   hostname: parsedUrl.host,
        //   path: parsedUrl.pathname,
        //   method: 'GET',
        //   headers: {
        //     'Authorization': 'Bearer ' + ic.oAuthToken.access_token,
        //     cookie: session.opaCookie.map(c => {
        //       const cParts = c.split(';')[0].split('=')
        //       return querystring.stringify({ [cParts[0]]: cParts[1] })
        //     }).join('; ')
        //   }
        // },
        // (res) => {
        //   let body = ''
        //   res.on('data', data => {
        //     body += data
        //   })
        //   res.on('end', () => {
        //     var buf = Buffer.from(body)
        //     var fileInfo = fileType(buf)
        //     resolve(
        //       MessageModel.attachmentConversationMessage(
        //         'file',
        //         fileInfo.mime + ';base64, ' + buf.toString('base64')
        //       )
        //     )
        //   })
        // })
        // req.on('error', (e) => {
        //   ic.log.error('Failed to get form.')
        //   reject(e)
        // })
        // req.end()
        //
        // return
      }

      var str = text.replace(/<br>/gi, '\n')
      str = ibBot.replaceHTML(str)
      var chunks = []
      for (var i = 0, charsLength = str.length; i < charsLength; i += 319) {
        chunks.push(str.substring(i, i + 319))
      }
      resolve(chunks)
    })
  }

  ibBot.replaceHTML = function (s) {
    var $ = require('cheerio')
    var $s = $('<div>' + s + '</div>')
    $s.find('a').each(function (i, e) {
      var $e = $(e)
      $e.html($e.attr('href'))
    })
    return $s.text()
  }

  /*ibBot.formatQuestion = function (question, opts) {
    if (question.type === 'boolean' || question.kind === 'collect') {
      return ibBot.getConfirmQuestion(
        question.text,
        opts[0].text,
        opts[1].text
      )
    }
    if (!opts) return question.text
    var plainQuestion = ibBot.formatPlainQuestion(question, opts)
    // if (question.type == ('typ\\:reference-relationship-control')) {
    // quick replies don't work well if the name of the target entity is long (> 12 or so chars)
    // return ((opts.length > 11) ? plainQuestion : ibBot.formatQuestionQuickReplies(question, opts))
    //   return plainQuestion
    // }
    if (
      (question.type === 'boolean' &&
        question.inputType === 'text-image-button-group') ||
      question.inputType === 'text-button-group'
    ) {
      return opts.length > 11
        ? plainQuestion
        : ibBot.formatQuestionQuickReplies(question, opts)
    }
    if (
      question.type !== 'boolean' &&
      question.inputType === 'text-image-button-group'
    ) {
      return ibBot.formatQuestionTextAndImage(question, opts)
    }

    return plainQuestion
  }
*/

ibBot.formatQuestion = function (question, opts, header, channel) {

  //crap handling if there is no question text
  if (question.text==="")
    question.text="Choose?"

  if (question.inputType === 'slider' || question.inputType === 'switch' ||
    question.inputType === 'Calendar')
  {
    return question.text
  }
 
  if (question.kind==='upload')
  {
    return question.text + '\nUse the add file/attachment button to upload.'
  }
  
  if (!opts) return question.text

  if (question.type === 'boolean' || question.kind === 'collect') {
    return ibBot.getConfirmQuestion(
      question.text,
      opts[0].text,
      opts[1].text
    )
  }
  
  if (question. inputType === 'text-button-group' || question. inputType === 'text-image-button-group' || question.inputType === 'image-button-group' ||
    question.inputType === 'Dropdown' || question.inputType === 'searching-combo' || question.inputType === 'Radiobutton' )
  {
    //var qrMsg = MessageModel.textConversationMessage(question.text)
    //var cardMsg = ibBot.formatQuestionTextAndImage(question, opts)
    header.headerText=question.text
    return ibBot.formatQuestionTextAndImage(question, opts, channel)
  }
  else
  {
    console.log("Question" + question.inputType + " : " + question.type);
    return question.text
  }
  //var plainQuestion = ibBot.formatPlainQuestion(question, opts)
  // if (question.type == ('typ\\:reference-relationship-control')) {
  // quick replies don't work well if the name of the target entity is long (> 12 or so chars)
  // return ((opts.length > 11) ? plainQuestion : ibBot.formatQuestionQuickReplies(question, opts))
  //   return plainQuestion
  // }
  //if (question.type === 'boolean' )
  //&& question.inputType === 'text-image-button-group') ||question.inputType === 'text-button-group') 
  //{
  //  return ibBot.formatQuestionQuickReplies(question, opts)
  //}
 

  //return plainQuestion
}
  ibBot.formatQuestionTextAndImage = function (question, opts, channel) {
    // carousel
    // ibBot.serveImages(opts)
    var orientation='horizontal'
    if (channel==="facebook")
        orientation='vertical'

    return MessageModel.cardConversationMessage( 
      orientation,
      opts.map(o =>
        MessageModel.cardObject(
          o.value,
          null,
          o['uncheckedImageURL'],
          null,
          [MessageModel.postbackActionObject(o.text,null,o.value) ]
          
        )
      )//,[],
       //question.text
    )
  }

  ibBot.formatQuestionQuickReplies = function (question, opts) {

    var qrMsg = MessageModel.textConversationMessage(question.text)
    MessageModel.addGlobalActions(
      qrMsg,
      opts.map(o =>
        MessageModel.postbackActionObject(
          o.text,
          o['unchecked-image-url'],
          o.value
        )
      )
    )
    return qrMsg
  }



  ibBot.getConfirmQuestion = function (text, trueWord, falseWord) {
    return ibBot.formatQuestionQuickReplies({ text: text }, [
      {
        text: trueWord,
        value: 'true',
        'unchecked-image-url': ibBot.configuration.env.YES_IMAGE_URL
      },
      {
        text: falseWord,
        value: 'false',
        'unchecked-image-url': ibBot.configuration.env.NO_IMAGE_URL
      }
    ])
  }

  return ibBot
}

module.exports = IBOPABot
