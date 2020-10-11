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

app.get("/",checkNotAuth,(req,res)=>{
  res.sendFile("/views/login.html")
})

app.get("/dashboard",checkAuth,(req, res) => {
  res.sendFile("/views/dash.html", { 
    root: __dirname,
  });
});

app.get('/generateRoomId',checkAuth,(req,res)=>{
    const rid = generateURL()
    res.redirect(`/${rid}`)
})

app.get('/checkRoomId',checkAuth,(req,res)=>{
  const {roomId} = req.query
  if(rooms.hasOwnProperty(roomId)){
      res.redirect(`/${roomId}`)
  }
  res.redirect(`/dashboard`)
})

app.get("/:roomId",checkAuth,(req, res) => {
  res.sendFile("/views/room-lobby.html", { 
    root: __dirname,
  });
});

app.get('/mail',(req,res)=>{

  [url] = req.query
  res.render("email",{url})
})

function checkAuth(req,res,next){
  var authenticate = true

  if(!authenticate){
    res.redirect('/login')
  }
  next()
}

function checkNotAuth(req,res,next){
  var authenticate = true

  if(!authenticate){
    next()
  }
  res.redirect('/dashboard')
}

function generateURL(){
  let rid=""
  for(let i=0;i<2;i++){
    for(let j=0;j<2;j++){
      let rand = Math.floor(Math.random() * 26)+97;
      rid = rid + String.fromCharCode(rand);
      rand = Math.floor(Math.random() * 10)+48;
      rid = rid + rand
    }
    rid = rid + '-'
  }
  if(rooms.hasOwnProperty(rid)) generateURL()
  return rid
}

function checkAllUserConnection(roomId){
  let clients = Object.keys(rooms[roomId])
  clients.forEach(user=>{
    if(rooms[roomId][user].readyState !== WebSocket.OPEN){
      delete rooms[roomId][user]
    }
  }
  )
}

function checkUserConnection(roomId,user){
  if(rooms[roomId][user].readyState === WebSocket.OPEN){
    return true
  }
  delete rooms[roomId][user]
  return false
}

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
      if(rooms.hasOwnProperty(roomId)){
        checkAllUserConnection(roomId)
        users=Object.keys(rooms[roomId])
      }
      broadcast("",{type:"users",users,roomId})
    }

    else if (data.type=='offer') {
      console.log("received: offer")
      var {roomId,userA,userB}=data
      console.log(rooms)
      if(checkUserConnection(roomId,userA)){   
          var connA = rooms[roomId][userA]
          send(connA,{type:"offer",userB,offer:data.offer});
      }
      else{
        send(conn,{type:"disconnect",userId:userA,roomId})
      }
    }

    else if (data.type=='answer') {
      console.log("received: answer")
     
      var {roomId,userA,userB}=data
      if(checkUserConnection(roomId,userA)){      
        var connA = rooms[roomId][userA]
        send(connA,{type:"answer",userA,answer:data.answer,userB});
     }
     else{
      send(conn,{type:"disconnect",userId:userA,roomId})
     }
    }
    
    else if(data.type='candidate'){
      console.log("received: candidate")
      console.log(data.userId)
      broadcast(data.userId,data);
    }
  });
});

setInterval(()=>{
  var r = Object.keys(rooms)
  for(const room of r){
      var u = Object.keys(rooms[room])
      for(const uid of u){
        if(rooms[room][uid].readyState !== WebSocket.OPEN){
          delete rooms[room][uid]
          broadcast("",{type:'disconnect',roomId:room,userId:uid})
        }
      }
  }
},2000)

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
