const http = require("http");
const express = require("express");
const app = express();
const WebSocket = require("ws");
const ejs = require('ejs')
const server = http.createServer(app);
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile("/views/room.html", { 
    root: __dirname,
  });
});

app.get('/mail',(req,res)=>{

  [url] = req.query
  res.render("email",{url})
})

function send(con,message) { 
  con.send(JSON.stringify(message)); 
};
var clients = []
const ws = new WebSocket.Server({ server });
var users=0;

ws.on("connection", function connection(conn) {
  console.log("client connected")
  conn.name=
  clients.push(conn)
  conn.on("message", function incoming(msg) {
    let data = JSON.parse(msg);
    if (data.type=='offer') {
      console.log("received: ")
      broadcast(conn,data);
    }
    else if (data.type=='answer') {
      console.log("received: ")
      broadcast(conn,data);
    }
    else if(data.type='candidate'){
      console.log("received: ")
      broadcast(conn,data);
    }
  });
});
function broadcast(conn,message) {
  ws.clients.forEach((client) => {
      if(client!=conn) send(client,message);
    }
  );
}
server.listen(8080);
