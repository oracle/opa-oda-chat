/*
* Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
* Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
*/
module.exports = {
  OPA_SESSION_TIMEOUT_MINS: 30,
  LOG_LEVEL: 'TRACE',

  // Use https://appzaza.com/encrypt-text to encrypt your chat API credentials with these parameters
  //  before adding to your BotML flow.
  // Specify CRYPTO_SECRET for Password1 and CRYPTO_IV for Password2 and algorithm 'AES-256-CBC'
  CRYPTO_SECRET: '6cccdab95e0530786e24b152b47e58c4',
  CRYPTO_IV: '14409ce40c598250',

  YES_IMAGE_URL: 'https://i.imgur.com/ZDqOKCt.png',
  NO_IMAGE_URL: 'https://i.imgur.com/Vd9APZT.png'
}
