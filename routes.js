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
    const map = JSON.parse(data.toString(), reviver)
    const keys = ['', 'hardMode', 'hardModegridHardMode', 'hardModehiddenLetterMode', 
      'hardModegridHardModehiddenLetterMode', 'gridHardMode', 'gridHardModehiddenLetterMode', 'hiddenLetterMode']
    
    for (const timestampKey of map.keys()){
      const timestampMap = map.get(timestampKey)
      for (const key of keys){
        const keyMap = timestampMap.get(key)
        if(keyMap !== null && keyMap !== undefined) {
          timestampMap.set('english' + key, keyMap)
          timestampMap.delete(key)
        }
      }
    }

    return map
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
}, 60 * 60 * 1000)
//every hour

function countPlayers(){
  if(users === undefined){
    return 0
  }

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

      const date = fns.startOfDay(new Date(Math.floor((Math.random() * 2) * Date.now())))
      const gameMap = new Map() 
      gameMap.set('gameDate', date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate())
      gameMap.set('guesses', [])
      gameMap.set('guessesPlayer1', [])
      gameMap.set('guessesPlayer2', [])
      gameMap.set('player1', currentUser)
      gameMap.set('timestamp', Date.now())
      gameMap.set('customCode', Math.floor(100000000000 + Math.random() * 900000000000).toString())

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

  if(currentUser === userGame.get(currentUser).get('player1')){
    userGame.get(currentUser).get('guessesPlayer1').push(guess)
  } else {
    userGame.get(currentUser).get('guessesPlayer2').push(guess)
  }

  return res.json(ok);
});

function getKey(key) {
  var localKey = key
  if(localKey === null || localKey  === undefined) {
    localKey  = 'english'
  }

  const keys = ['', 'hardMode', 'hardModegridHardMode', 'hardModehiddenLetterMode', 
    'hardModegridHardModehiddenLetterMode', 'gridHardMode', 'gridHardModehiddenLetterMode', 'hiddenLetterMode']
  
    if(keys.includes(key)){
      return 'english' + key
    }

  return localKey
}

function addGlobalGuess(guessMap, guess) {
  if(guessMap.get(guess) === undefined) {
    guessMap.set(guess, 1)
  } else {
    guessMap.set(guess, guessMap.get(guess) + 1)
  }
}

function mergeGlobalGuess(guessMap, guess) {
  const key = guess[0]
  const value = guess[1]
  if(guessMap.get(key) === undefined) {
    guessMap.set(key, value)
  } else {
    guessMap.set(key, guessMap.get(key) + value)
  }
}

function mergeMap(mainMap, secondMap, guessIndex) {
  if(secondMap.get(guessIndex) !== undefined && secondMap.get(guessIndex) !== null) {
    var newGuessIndexMap = new Map()
    if(mainMap.get(guessIndex) !== undefined && mainMap.get(guessIndex) !== null) {
      newGuessIndexMap = new Map(mainMap.get(guessIndex))
    }

    for(const guess of secondMap.get(guessIndex)){
      mergeGlobalGuess(newGuessIndexMap, guess)
    }
    mainMap.set(guessIndex, newGuessIndexMap)
  }
}

function mergeMaps(map, key, guessIndex) {
  var newMap = new Map(map)
  const keys = ['hardMode', 'hardModegridHardMode', 'hardModehiddenLetterMode', 'hardModegridHardModehiddenLetterMode', 
                'gridHardMode', 'gridHardModehiddenLetterMode', 'hiddenLetterMode']
  
  if(newMap.get(key) === undefined || newMap.get(key) === null) {
    newMap.set(key, new Map())
  }

  const newSubMap = new Map(newMap.get(key))
  for (const subKey of keys) {
    const secMap = newMap.get(key + subKey)
    if(secMap !== null && secMap !== undefined) {
      mergeMap(newSubMap, secMap, guessIndex)
    }
    newMap.delete(key + subKey)
  }
  newMap.set(key, newSubMap)          

  return newMap.get(key).get(guessIndex)
}

router.get("/addglobalguess", function(req, res) {
  console.log('addglobalguess')

  const guess = req.query.guess
  const timestamp = new Date(+req.query.year, +req.query.month, +req.query.day).getTime()
  const guessIndex = +req.query.guessindex 
  const key = getKey(req.query.key)

  if(globalGuesses.get(timestamp) === undefined) {
    globalGuesses.set(timestamp, new Map())
  }
  const timestampMap = globalGuesses.get(timestamp)

  if(timestampMap.get(key) === undefined) {
    timestampMap.set(key, new Map())
  }

  const keyMap = timestampMap.get(key)

  if(keyMap.get(guessIndex) === undefined) {
    keyMap.set(guessIndex, new Map())
  }
  addGlobalGuess(keyMap.get(guessIndex), guess)

  return res.json(ok);
});

router.get("/getallglobalguesses", function(req, res) {
  console.log('getallglobalguesses')

  const timestamp = new Date(+req.query.year, +req.query.month, +req.query.day).getTime()
  //not transforming into a number here (done below), because I can't, for some reason, === on NaN
  const guessIndex = req.query.guessindex 
  const plainKey = getKey(req.query.key)


  if(globalGuesses.get(timestamp) === undefined) {
    console.log("time undefined")
    return res.json([
      { 
        global: ""
      }
    ])
  }

  const timestampMap = globalGuesses.get(timestamp)

  if(timestampMap.get(plainKey) === undefined) {
    console.log("Map empty for key: " + key)
    return res.json([
      { 
        global: ""
      }
    ])
  }
  const keyMap = timestampMap.get(plainKey)
  
  if(guessIndex === undefined) {
    console.log("guessIndex undefined")
    return res.json([
      { 
        global: ""
      }
    ])
  }

  var guessIndexMap = keyMap.get(+guessIndex)
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
      global: JSON.stringify(mergeMaps(timestampMap, plainKey, +guessIndex), replacer)
    }
  ])

})

router.get("/getglobalguesses", function(req, res) {
  console.log('getglobalguesses')

  const timestamp = new Date(+req.query.year, +req.query.month, +req.query.day).getTime()
  //not transforming into a number here (done below), because I can't, for some reason, === on NaN
  const guessIndex = req.query.guessindex 
  const key = getKey(req.query.key)

  if(globalGuesses.get(timestamp) === undefined) {
    console.log("time undefined")
    return res.json([
      { 
        global: ""
      }
    ])
  }

  const timestampMap = globalGuesses.get(timestamp)

  if(timestampMap.get(key) === undefined) {
    console.log("Map empty for key: " + key)
    return res.json([
      { 
        global: ""
      }
    ])
  }
  const keyMap = timestampMap.get(key)
  
  if(guessIndex === undefined) {
    console.log("guessIndex undefined")
    return res.json([
      { 
        global: JSON.stringify(keyMap, replacer)
      }
    ])
  }

  var guessIndexMap = keyMap.get(+guessIndex)
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
