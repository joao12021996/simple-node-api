const express = require('express');
const wait = require("./json/wait");
const ok = require("./json/ok");
const fns = require('date-fns')

const userWait = new Map()
const userWaitListTimes = new Map()
const users = new Map()
const userInfo = new Map()
const customUsers = new Map()
const userGame = new Map()

const router = express.Router();

setInterval(function(){

}, 2* 60000)
//every 2 min

function removePlayer(user){
  for (let [_, value] of userWait.entries()) {
    value.pop(user)
  }
}

function countPlayers(){
  total = 0
  for (let [_, value] of userWait.entries()) {
    total = total + value.size
  }

  return total
}

router.get("/newgame", function(req, res) { 
  console.log('newgame')
  console.log(userWait)

  const currentUser = req.query.name
  const currentUserCustom = req.query.customname
  const gameMode = req.query.gamemode
  const hardMode = req.query.hardmode
  const gridHardMode = req.query.gridhardmode
  const hiddenLetterMode = req.query.hiddenlettermode
  const language = req.query.language

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
    removePlayer(currentUser)

    userWait.get(key).push(currentUser)
    userWaitListTimes.set(currentUser, Date.now())
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
      userWaitListTimes.delete(user)
      userWaitListTimes.delete(currentUser)

      users.set(user, currentUser)
      users.set(currentUser, user)

      const date = fns.startOfDay(new Date(Math.floor((Math.random() * 2) * Date.now())))
      const gameMap = new Map() 
      gameMap.set('gameDate', date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDay())
      gameMap.set('guesses', [])
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

  res.json(wait);
});

router.get("/addguess", function(req, res) {
  console.log('addguess')

  const currentUser = req.query.name
  const guess = req.query.guess

  userGame.get(currentUser).get('guesses').push(guess)
  userGame.get(currentUser).set('timestamp', +req.query.timestamp)

  console.log(guess)

  res.json(ok);
});

router.get("/getguess", function(req, res) {
  console.log('getguess')

  if(userGame.get(req.query.name) === undefined){
    res.json([
      {
        response: '404'
      }
    ])
  }

  console.log(userGame.get(req.query.name))
  res.json([
    {
      response: 'ok',
      guesses: userGame.get(req.query.name).get('guesses'),
      timestamp: userGame.get(req.query.name).get('timestamp')
    }
  ])
});

router.get("/onlineplayers", function(req, res){
  console.log('onlineplayers')

  const gameMode = req.query.gamemode
  const hardMode = req.query.hardmode
  const gridHardMode = req.query.gridhardmode
  const hiddenLetterMode = req.query.hiddenlettermode
  const language = req.query.language

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

  return res.json([
    {
      subTotal: userWait.get(key).size(),
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
  userWait.get(key).pop(currentUser)
  users.delete(opponent)
  userGame.delete(opponent)
  userInfo.delete(opponent)
  userWait.get(key).pop(opponent)

  return res.json([
    { 
      response: 'ok'
    }
  ])
})

module.exports = router;
