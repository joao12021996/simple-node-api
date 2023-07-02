const express = require('express');
const wait = require("./json/wait");
const ok = require("./json/ok");
const fns = require('date-fns')

const userWaitList = []
const users = new Map()
const userInfo = new Map()
const customUsers = new Map()
const userGame = new Map()

const router = express.Router();

router.get("/newgame", function(req, res) { 
  console.log('newgame')
  console.log(userWaitList)

  const currentUser = req.query.name
  const currentUserCustom = req.query.customname

  if(users.get(currentUser) !== undefined){
    return res.json([
      { 
        response: 'go',
        opponent: customUsers.get(users.get(currentUser)),
        gameDate: userGame.get(currentUser).get('gameDate'),
        timestamp: userGame.get(currentUser).get('timestamp'),
        country: userInfo.get(users.get(currentUser)).get('country')
      }
    ])
  }

  if(!userWaitList.includes(currentUser)){
    userWaitList.push(currentUser)
    customUsers.set(currentUser, currentUserCustom)

    userInfo.set(currentUser, new Map())

    if(req.query.country === undefined || req.query.country === null){
      userInfo.get(currentUser).set('country', '')
    }else {
      userInfo.get(currentUser).set('country', req.query.country)
    }
  }
  
  for(let user of userWaitList){
    if(user !== currentUser){
      userWaitList.pop(user)
      userWaitList.pop(currentUser)

      users.set(user, currentUser)
      users.set(currentUser, user)

      const date = fns.startOfDay(new Date(Math.floor((Math.random() * 2) * Date.now())))
      const gameMap = new Map() 
      gameMap.set('gameDate', date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDay())
      gameMap.set('guesses', [])
      gameMap.set('timestamp', Date.now())

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
          country: userInfo.get(user).get('country')
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

  return res.json([
    {
      size: userWaitList.length
    }
  ])
})

router.get("/endgame", function(req, res) {
  console.log('endgame')

  const currentUser = req.query.name

  if(users.get(currentUser) === undefined){
    return res.json([
      { 
        response: '404',
      }
    ])
  }
  
  users.delete(currentUser)
  userGame.delete(currentUser)
  userInfo.delete(currentUser)

  return res.json([
    { 
      response: 'ok'
    }
  ])
});


module.exports = router;
