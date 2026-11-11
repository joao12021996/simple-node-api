const express = require('express');
const wait = require("./json/wait");
const ok = require("./json/ok");
const fns = require('date-fns');

var userWait = new Map()
const users = new Map()
const userInfo = new Map()
const customUsers = new Map()
const userGame = new Map()

const router = express.Router();

setInterval(function(){
  userWait = new Map()
}, 10000)
//every 10 seconds

function countPlayers(){
  if(users === undefined){
    return 0
  }

  return users.size
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
