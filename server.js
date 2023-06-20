const express = require("express");
const routes = require("./routes");

// App
const app = express();

// Set port
const port = process.env.PORT || "1337";
app.set("port", port);

const cors = require('cors');
app.use(cors({
    origin: '*'
}));
app.use('/', routes);

// Server
app.listen(port, () => console.log(`Server running on localhost:${port}`));
