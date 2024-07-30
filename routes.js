const express = require('express');
const wait = require("./json/wait");
const ok = require("./json/ok");
const fns = require('date-fns');
const fs = require('fs') 

var userWait = new Map()
const users = new Map()
const userInfo = new Map()
const customUsers = new Map()
const userGame = new Map()

function replacer(key, value) {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}
function reviver(key, value) {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

function initGlobalMap(){
  const fs = require('fs'); 
  try{ 
    const data = fs.readFileSync('save.txt') 
    return JSON.parse(data.toString(), reviver)
  } catch (err) { 
    console.error(err); 
  } 

  return new Map()
}

const globalGuesses = initGlobalMap()

const router = express.Router();

setInterval(function(){
  userWait = new Map()
}, 10000)
//every 10 seconds

setInterval(function(){
  saveFile()
}, 60 * 60 * 1000)//60 * 60 * 1000
//every hour

function countPlayers(){
  if(users === undefined){
    return 0
  }

  console.log(users.entries)

  return users.size
}

function saveFile(){
  const fs = require('fs'); 
  fs.writeFile('save.txt', JSON.stringify(globalGuesses, replacer), (err) => { 
    if (err) throw err; 
    console.log('File written!'); 
  }); 
}

router.get("/newgame", function(req, res) { 
  console.log('newgame')
  console.log(userWait.entries())

  const currentUser = req.query.name
  const currentUserCustom = req.query.customname
  const gameMode = req.query.gamemode
  const hardMode = req.query.hardmode
  const gridHardMode = req.query.gridhardmode
  const hiddenLetterMode = req.query.hiddenlettermode
  const language = req.query.language
  const customGame = req.query.customgame

  var key = ''
  if(gameMode){
    key = 'team'
  }
  if(hardMode){
    key = key + 'hardMode'
  }
  if(gridHardMode){
    key = key + 'gridHardMode'
  }
  if(hiddenLetterMode){
    key = key + 'hiddenLetterMode'
  }
  if(language){
    key = key + language
  }
  if(customGame){
    key = key + customGame
  }

  if(users.get(currentUser) !== undefined){
    return res.json([
      { 
        response: 'go',
        opponent: customUsers.get(users.get(currentUser)),
        gameDate: userGame.get(currentUser).get('gameDate'),
        timestamp: userGame.get(currentUser).get('timestamp'),
        country: userInfo.get(users.get(currentUser)).get('country'),
        customCode: userGame.get(currentUser).get('customCode')
      }
    ])
  }

  if(!userWait.has(key)){
    userWait.set(key, [])
  }

  if(!userWait.get(key).includes(currentUser)){
    userWait.get(key).push(currentUser)
    customUsers.set(currentUser, currentUserCustom)

    userInfo.set(currentUser, new Map())

    if(req.query.country === undefined || req.query.country === null){
      userInfo.get(currentUser).set('country', '')
    }else {
      userInfo.get(currentUser).set('country', req.query.country)
    }
  }
    
  for(let user of userWait.get(key)){
    if(user !== currentUser){
      userWait.get(key).pop(user)
      userWait.get(key).pop(currentUser)

      users.set(user, currentUser)
      users.set(currentUser, user)

      console.log(users)

      const date = fns.startOfDay(new Date(Math.floor((Math.random() * 2) * Date.now())))
      const gameMap = new Map() 
      gameMap.set('gameDate', date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate())
      gameMap.set('guesses', [])
      gameMap.set('guessesPlayer1', [])
      gameMap.set('guessesPlayer2', [])
      gameMap.set('player1', currentUser)
      gameMap.set('timestamp', Date.now())
      gameMap.set('customCode', Math.floor(100000000000 + Math.random() * 900000000000).toString())

      console.log(gameMap.get('gameDate'))

      //shared on purpose since they belong to the same game
      userGame.set(user, gameMap)
      userGame.set(currentUser, gameMap)

      return res.json([
        { 
          response: 'go',
          opponent: customUsers.get(user),
          first: true,
          gameDate: gameMap.get('gameDate'),
          timestamp: gameMap.get('timestamp'),
          country: userInfo.get(user).get('country'),
          customCode: gameMap.get('customCode')
        }
      ])
    }
  }

  return res.json(wait);
});

router.get("/addguess", function(req, res) {
  console.log('addguess')

  const currentUser = req.query.name
  const guess = req.query.guess

  userGame.get(currentUser).get('guesses').push(guess)
  userGame.get(currentUser).set('timestamp', +req.query.timestamp)

  console.log(currentUser)
  console.log(userGame.get(currentUser).get('player1'))
  if(currentUser === userGame.get(currentUser).get('player1')){
    userGame.get(currentUser).get('guessesPlayer1').push(guess)
  } else {
    userGame.get(currentUser).get('guessesPlayer2').push(guess)
  }

  console.log(guess)

  return res.json(ok);
});

function getKey(key) {
  var localKey = key
  if(localKey === null || localKey  === undefined) {
    localKey  = ''
  }

  return localKey
}

router.get("/addglobalguess", function(req, res) {
  console.log('addglobalguess')
  console.log(req.query.guess)

  const guess = req.query.guess
  const timestamp = new Date(+req.query.year, +req.query.month, +req.query.day).getTime()
  const guessIndex = +req.query.guessindex 
  const key = getKey(req.query.key)
  const timestampKey = key + timestamp

  if(globalGuesses.get(timestampKey) === undefined) {
    globalGuesses.set(timestampKey, new Map())
  }

  const timestampMap = globalGuesses.get(timestampKey)

  if(timestampMap.get(guessIndex) === undefined) {
    timestampMap.set(guessIndex, new Map())
  }

  const guessIndexMap = timestampMap.get(guessIndex)
  if(guessIndexMap.get(guess) === undefined) {
    guessIndexMap.set(guess, 1)
  } else {
    guessIndexMap.set(guess, guessIndexMap.get(guess) + 1)
  }

  return res.json(ok);
});

router.get("/getglobalguesses", function(req, res) {
  console.log('getglobalguesses')

  const timestamp = new Date(+req.query.year, +req.query.month, +req.query.day).getTime()
  //not transforming into a number here (done below), because I can't, for some reason, === on NaN
  const guessIndex = req.query.guessindex 
  const key = getKey(req.query.key)
  const timestampKey = key + timestamp

  console.log(timestampKey)
  console.log(guessIndex)
  console.log(globalGuesses)

  if(globalGuesses.get(timestampKey) === undefined) {
    console.log("time undefined")
    return res.json([
      { 
        global: ""
      }
    ])
  }

  const timestampMap = globalGuesses.get(timestampKey)
  
  if(guessIndex === undefined) {
    console.log("guessIndex undefined")
    return res.json([
      { 
        global: JSON.stringify(timestampMap, replacer)
      }
    ])
  }

  var guessIndexMap = timestampMap.get(+guessIndex)
  if(guessIndexMap === undefined) {
    console.log("guessIndexMap undefined")
    return res.json([
      { 
        global: ""
      }
    ])
  }

  return res.json([
    { 
      global: JSON.stringify(guessIndexMap, replacer)
    }
  ])

})

router.get("/saveGlobalGuesses", function(req, res) {
  console.log('saveGlobalGuesses')

  saveFile()

  return res.json(ok);
})

router.get("/getguess", function(req, res) {
  console.log('getguess')

  if(userGame.get(req.query.name) === undefined){
    return res.json([
      {
        response: '404'
      }
    ])
  }

  console.log(userGame.get(req.query.name))
  return res.json([
    {
      response: 'ok',
      guesses: userGame.get(req.query.name).get('guesses'),
      player1: userGame.get(req.query.name).get('player1'),
      guessesPlayer1: userGame.get(req.query.name).get('guessesPlayer1'),
      guessesPlayer2: userGame.get(req.query.name).get('guessesPlayer2'),
      timestamp: userGame.get(req.query.name).get('timestamp')
    }
  ])
});

router.get("/onlineplayers", function(_, res){
  console.log('onlineplayers')

  return res.json([
    {
      total: countPlayers()
    }
  ])
})

router.get("/endgame", function(req, res) {
  console.log('endgame')

  const currentUser = req.query.name
  const gameMode = req.query.gamemode
  const hardMode = req.query.hardmode
  const gridHardMode = req.query.gridhardmode
  const hiddenLetterMode = req.query.hiddenlettermode
  const customGame = req.query.customgame

  var key = ''
  if(gameMode){
    key = 'team'
  }
  if(hardMode){
    key = key + 'hardMode'
  }
  if(gridHardMode){
    key = key + 'gridHardMode'
  }
  if(hiddenLetterMode){
    key = key + 'hiddenLetterMode'
  }
  if(customGame){
    key = key + customGame
  }

  if(users.get(currentUser) === undefined){
    return res.json([
      { 
        response: '404',
      }
    ])
  }
  
  const opponent = users.get(currentUser)

  users.delete(currentUser)
  userGame.delete(currentUser)
  userInfo.delete(currentUser)
  users.delete(opponent)
  userGame.delete(opponent)
  userInfo.delete(opponent)

  if(userWait.get(key) === undefined){
    userWait.get(key).pop(currentUser)
    userWait.get(key).pop(opponent)
  }

  return res.json([
    { 
      response: 'ok'
    }
  ])
})

module.exports = router;
