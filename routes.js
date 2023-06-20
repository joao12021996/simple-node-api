const express = require('express');
const wait = require("./json/wait");
const ok = require("./json/ok");

const userWaitList = []
const users = new Map()
const userGame = new Map()

const router = express.Router();

router.get("/newgame", function(req, res) {
  const currentUser = req.query.name

  if(users.get(currentUser) !== undefined){
    return res.json([
      { 
        response: 'go',
        opponent: users.get(currentUser),
        gameDate: userGame.get(currentUser).get('gameDate')
      }
    ])
  }

  if(!userWaitList.includes(currentUser)){
    userWaitList.push(currentUser)
  }
  
  for(let user of userWaitList){
    if(user !== currentUser){
      userWaitList.pop(user)
      userWaitList.pop(currentUser)

      users.set(user, currentUser)
      users.set(currentUser, user)

      const gameMap = new Map() 
      gameMap.set('gameDate', new Date(Math.floor((Math.random() * 2) * Date.now())))
      gameMap.set('guesses', [])

      //shared on purpose since they belong to the same game
      userGame.set(user, gameMap)
      userGame.set(currentUser, gameMap)

      return res.json([
        { 
          response: 'go',
          opponent: user,
          first: true,
          gameDate: gameMap.get('gameDate')
        }
      ])
    }
  }
  console.log(userWaitList)

  res.json(wait);
});

router.get("/addguess", function(req, res) {
  const currentUser = req.query.name
  const guess = req.query.guess

  userGame.get(currentUser).get('guesses').push(guess)

  console.log(guess)

  res.json(ok);
});

router.get("/getguess", function(req, res) {
  res.json([
    {
      response: 'ok',
      guesses: userGame.get(req.query.name).get('guesses')
    }
  ])
});

router.get("/onlineplayers", function(req, res){
  return res.json([
    {
      size: userWaitList.length
    }
  ])
})

router.get("/endgame", function(req, res) {
  console.log(req.query)
  console.log('endgame')

  const currentUser = req.query.name

  if(users.get(currentUser) === undefined){
    return res.json([
      { 
        response: '404 no-user',
      }
    ])
  }
  
  users.delete(currentUser)
  userGame.delete(currentUser)

  if(!userWaitList.includes(currentUser)){
    userWaitList.push(currentUser)
  }

  return res.json([
    { 
      response: 'ok'
    }
  ])
});


module.exports = router;
