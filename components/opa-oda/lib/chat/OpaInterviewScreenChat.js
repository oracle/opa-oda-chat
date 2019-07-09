/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* The Universal Permissive License (UPL), Version 1.0
*/
var moment = require('moment')
var chrono = require('chrono-node')

module.exports = OpaInterviewScreen

function OpaInterviewScreen (res, env, logger) {
  this.log = logger
  this.res = res
  this.env = env
  this.greetings = []

  this.firstInput = this.res.items.find(
    x => x.kind === 'input' || x.kind === 'collect' || x.kind === 'upload'
  )
  this.labelControls = this.res.items.filter(
    x => x.kind !== 'input' && x.kind !== 'collect' && x.kind !== 'upload'
  )

  this.warningControls = this.res.warnings || []
  this.errorControls = this.res.errors || []
}

OpaInterviewScreen.prototype = {
  constructor: OpaInterviewScreen,
  setGreeting: function (greetings) {
    this.greetings = greetings
  },
  buildSubmitData: function (inputVal, utterances) {
    var scr = this
    return new Promise(function (resolve, reject) {
      return scr.translateInput(inputVal, scr.firstInput.type, utterances)

      // UPLOADS (ATTACHMENTS???)
      // } else if (scr.firstInput.prop('name') == 'typ:attachment-control') {
      //   var attachmentURL = ''
      //   if (inputVal.startsWith('__image: ')) {
      //     attachmentURL = inputVal.substr(9)
      //   } else if (inputVal.startsWith('__file: ')) {
      //     attachmentURL = inputVal.substr(8)
      //   }
      //   rp({ uri: attachmentURL, encoding: null })
      //   .then((result) => {
      //     //convert to base64
      //     var b64 = new Buffer(result, 'binary').toString('base64')
      //     //build XML
      //     firstInputXML =
      //       ('<' + scr.firstInput.prop('name') + ' id='' + scr.firstInput.attr('id') + ''>' +
      //       '<files-to-upload>' +
      //         '<file file-name='image.jpg'>' + b64 + '</file>' +
      //       '</files-to-upload>' +
      //     '</' + scr.firstInput.prop('name') + '>')
      //     resolve(scr.buildInvestigateRequest(firstInputXML))
      //     return
      //   })
      //   .catch((err) => {
      //     scr.log.error('Error getting attachment data')
      //     reject(err)
      //   })
    })
  },
  buildInvestigateRequest: function (firstInputXML) {
    throw new Error('Not implemented')
  },
  buildEntityCollectSubmitDataString: function (
    inputVal,
    entityCollect,
    utterances
  ) {
    throw new Error('Not implemented')
  },
  hasQuestion: function () {
    return this.firstInput !== undefined
  },
  getQuestion: function () {
    return this.firstInput
  },
  getQuestionOptions: function (interviewConfig) {
    if (
      this.firstInput.type === 'boolean' ||
      this.firstInput.kind === 'collect'
    ) {
      return [
        {
          text: interviewConfig.trueWord,
          value: 'true',
          'unchecked-image-url': this.env.YES_IMAGE_URL
        },
        {
          text: interviewConfig.falseWord,
          value: 'false',
          'unchecked-image-url': this.env.NO_IMAGE_URL
        }
      ]
    }
    if (this.firstInput.options) {
      return this.firstInput.options.filter(function (o) {
        return o.text && o.text.length > 0
      })
      // .map(function (o, idx) { return {
      //   text: o.displayText,
      //   value: o.value
      //   // index: idx+1,
      //   // 'checked-image-url': $(o).find('typ\\:checked-image-url').text(),
      //   // 'unchecked-image-url': $(o).find('typ\\:unchecked-image-url').text(),
      //   // 'checked-image': $(o).find('typ\\:checked-image').map(function () { return { 'mime-type': $(this).attr('mime-type'), data: $(this).text() } })[0],
      //   // 'unchecked-image': $(o).find('typ\\:unchecked-image').map(function () { return { 'mime-type': $(this).attr('mime-type'), data: $(this).text() } })[0]
      //   }
      // }
    }
    // if (this.firstInput.find('typ\\:possible-targets').length > 0) {
    //   return this.firstInput.find('typ\\:possible-targets typ\\:target').get()
    //     //.filter(function (o) { return $(o).text().length > 0 })
    //     .map(function (o, idx) { return {
    //       text: $(o).attr('display-value'),
    //       value: $(o).text(),
    //       index: idx+1,
    //       'checked-image-url': $(o).find('typ\\:checked-image-url').text(),
    //       'unchecked-image-url': $(o).find('typ\\:unchecked-image-url').text(),
    //       'checked-image': $(o).find('typ\\:checked-image').map(function () { return { 'mime-type': $(this).attr('mime-type'), data: $(this).text() } })[0],
    //       'unchecked-image': $(o).find('typ\\:unchecked-image').map(function () { return { 'mime-type': $(this).attr('mime-type'), data: $(this).text() } })[0]
    //       }
    //   })
    // }
  },
  translateInput: function (input, dataType, utterances) {
    if (dataType === 'boolean') {
      if (utterances.yes.test(input.toLowerCase())) return 'true'
      else if (utterances.no.test(input.toLowerCase())) return 'false'
      else return input
    }
    if (dataType === 'date') {
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
  },
  getValueNodeType: function (inputType) {
    throw new Error('Not implemented')
  }
}
