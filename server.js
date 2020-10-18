const http = require("http");
const express = require("express");
const ejs = require('ejs')
const initializePassport = require('./passport_config.js')
const jwt = require("jsonwebtoken")
const passport = require('passport')
const flash=require('connect-flash')
const session=require('express-session')
var bodyParser = require('body-parser')


const app = express();
const server = http.createServer(app);
const WebSocket = require("ws");


// database connection 
// MySQL used here
var connection = require('./db_creds')
connection.connect((err)=>{
  if(err) throw err
  console.log('connected!')
})


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(__dirname));
app.use(express.json())
app.use(flash())
app.use(session({
	// key to encrpt
	secret: 'secret',
	// resave existing sesson id
	resave: false,
	// save empty session id
	saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())


// passport function call
initializePassport(passport, async username=>

	// getUserByUsername
 await searchUser(username)
,
	// getUserById
  async id=> await searchUser(id)
)


// query database
function searchUser(username){
  return new Promise((resolve,reject)=>{
    connection.query(`SELECT * FROM login where userid='${username}'`,(err, results, fields) => {
    if (err) resolve(null);
    else {
      return resolve(results[0])
     }
})})
}

// Object which stores info about connected users
var rooms = {} 


// endpoints

app.get("/",checkNotAuth,(req,res)=>{
  res.redirect("/login")
})

app.get("/login",checkNotAuth,(req,res)=>{
  res.sendFile("/views/login.html",{root:__dirname})
})

app.post('/login',passport.authenticate('local',{
	successRedirect: '/dashboard',
	failureRedirect: '/',
	failureFlash: true
}
),(req,res)=>{
	const user={name:username}
	const accessToken=jwt.sign(user,process.env.ACCESS_TOKEN)
	res.json({accessToken})
})

app.get("/signup",checkNotAuth,(req,res)=>{
  res.sendFile("/views/signup.html",{root:__dirname})
})

app.post("/signup",(req,res)=>{
  var data = req.body
  values=[]
  console.log(req.body)
  values.push(data.name)
  values.push(data.username)
  values.push(data.password)
  console.log(values)
  var sql = "INSERT INTO login (name,userid,password) VALUES ?"

  connection.query(sql,[[values]],(err,results)=>{
      if(err) res.redirect('/signup')
      console.log("user registered")
      res.redirect('/')
  })
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
  else{
  res.redirect(`/dashboard`)
  }
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
  
  if(req.isAuthenticated()){
		console.log("Auth true")
		next()
	}
	else{
		res.redirect('/login')
	}
}

function checkNotAuth(req,res,next){
  if(req.isAuthenticated()){
		return res.redirect('/dashboard')
	}
	next()
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

/* 

  structure of variable room


  var rooms ={}

  rooms = {
      roomId1 : {
        userId1 : connection1 ,
        userId2 : connection2 ,
      },
      roomId2 : {
        userId1 : connection1 ,
        userId2 : connection2 
      }
  }

*/

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
    
    else if(data.type=='disconnect'){
      console.log("received: disconnect")
      broadcast(data.userId,data)
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
  var {roomId,userId}=message
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
