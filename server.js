const http = require("http");
const express = require("express");
const app = express();
const WebSocket = require("ws");
const ejs = require('ejs')
const server = http.createServer(app);
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(__dirname));


var rooms = {} 
var clients = {}
app.get("/:roomId", (req, res) => {
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

const ws = new WebSocket.Server({ server });
var i=1;



ws.on("connection", function connection(conn) {
  console.log("client connected")
  conn.on("message", function incoming(msg) {

    let data = JSON.parse(msg);

    if(data.type=="enterlobby"){
      console.log(data.roomId)
      var {roomId}=data
      var userId=i
      i+=1
      if(!rooms.hasOwnProperty(roomId)) rooms[roomId]={}
      rooms[roomId][userId]=conn
      var connA=rooms[roomId][userId]
      send(connA,{type:"creds",userId})
    }
    else if(data.type=="users"){
      console.log("users:")
      var {roomId}=data
      var users=[]
      if(rooms.hasOwnProperty(roomId))
      {
        users=Object.keys(rooms[roomId])
      } 
      broadcast("",{type:"users",users,roomId})
    }

    else if (data.type=='offer') {
      console.log("received: offer")
      var {roomId,userA,userB}=data
      console.log(rooms)   
      var connA = rooms[roomId][userA]

      send(connA,{type:"offer",userB,offer:data.offer});
    }

    else if (data.type=='answer') {
      console.log("received: answer")
     
      var {roomId,userA,userB}=data   
      var connA = rooms[roomId][userA]

      send(connA,{type:"answer",userA,answer:data.answer,userB});
    }
    
    else if(data.type='candidate'){
      console.log("received: candidate")
      console.log(data.userId)
      broadcast(data.userId,data);
    }
  });
});

function broadcast(userId,message) {
  var {roomId}=message
  Object.keys(rooms[roomId]).forEach((uid) => {
      if(userId=="" || userId!=uid) send(rooms[roomId][uid],message);
      
    }
  );
}
let port = process.env.PORT;
if (port == null || port == "") {
  port = 8080;
}
server.listen(port);
