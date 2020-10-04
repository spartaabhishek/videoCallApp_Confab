const express = require("express");
const app = express();


const { v4: uuidv4 } = require("uuid");


app.set("view engine", "ejs");
app.use(express.static("public"));

app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});