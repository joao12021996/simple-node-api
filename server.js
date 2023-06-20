const express = require("express");
const routes = require("./routes");
const https = require("https");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require('cors');

// App
const app = express();

app.use(cors({
    origin: '*'
}));

// Post request for geetting input from
// the form
app.post("/mssg", function (req, res) {
  // Logging the form body
  console.log(req.body);
    
  // Redirecting to the root
  res.redirect("/");
});

app.use('/', routes);

// Configuring express to use body-parser
// as middle-ware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Creating object of key and certificate
// for SSL
const options = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert"),
};

// Creating https server by passing
// options and app object
https.createServer(options, app)
  .listen(1337, function (req, res) {
  console.log("Server started at port 1337");
});
