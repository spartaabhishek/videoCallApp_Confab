/*
  webrtc ->
      1) get local video
      2) connect peers using RTCPeerconnection
      3) Send remote Video -> track
*/


/*
  Flow ->

  1) on-websocket-connect => start local video , get enterlobby , get users (RTC connection initialised)
  2) on-click-event-to-connect => Send offer , set local description
  3) on-answer-to-offer => set Remote desc
  4) on-track-event => display track in Video element

*/


// logic for better audio , predefined audio class

let audioContext;
if (typeof AudioContext === 'function') {
  audioContext = new AudioContext();
} else if (typeof webkitAudioContext === 'function') {
  audioContext = new webkitAudioContext(); 
} else {
  console.log('Sorry! Web Audio not supported.');
}
var filterNode = audioContext.createBiquadFilter();
filterNode.type = 'highpass';
filterNode.frequency.value = 10000;
var gainNode = audioContext.createGain();
gainNode.gain.value = 0.5;



var url = location.origin.replace(/^http/, 'ws')

// signalling - a medium to share info between two peers (clients)
const signaling = new WebSocket(url);

//incoming video constraints
const constraints = {video: {
  width: { min: 640, max: 1024 },
  height: { min: 480, max: 768 },
  aspectRatio: { ideal: 1.7777777778 }
},
audio: true};





var dataConstraint = null;
var userId=""
var roomId=window.location.href.substring(window.location.href.indexOf(location.origin)+window.location.origin.length+1)
var roomUsers=[]



// ICE STUN server 
// Used to bypass Network Address Translation
// local ip -> public ip
const config = {
  'iceServers': [
      { url: 'stun:stun1.l.google.com:19302' },
      {
          url: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
      },
      {url:'stun:stun.l.google.com:19302'},
      {url:'stun:stun2.l.google.com:19302'},
      {url:'stun:stun3.l.google.com:19302'},
      {url:'stun:stun4.l.google.com:19302'},
      {url:'stun:stunserver.org'}
  ]
}


const peers ={}


// converts javascript object to JSON and sends to server
// JSON - stringified form of javascript object
async function send(message) { 
  console.log(message)
  await signaling.send(JSON.stringify(message)); 
};


// local video element 
// by using getUserMedia function()
async function start(pc) {
  try {
    // get local stream, show it in self-view and add it to be sent
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const mediaStreamSource =
    audioContext.createMediaStreamSource(stream);
    mediaStreamSource.connect(filterNode);
    filterNode.connect(gainNode);
    // connect the gain node to the destination (i.e. play the sound)
    gainNode.connect(audioContext.destination);
    if(pc!=""){
      stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
      })
  }
      
      let selfView = document.getElementById("local-video");
      console.log("set local video")
      selfView.srcObject = stream;
      selfView.muted=true
      document.getElementById("video-grid").appendChild(selfView)
    
    
  } catch (err) {
    console.error(err);
  }
}


// track event fired after offer/answer completion
// adding remote video  
function handleTrack(pc,user){

  // peers[user]["con"] == pc
  pc.addEventListener('track', async (event) => {
    var remoteStream=new MediaStream()
    remoteStream.addTrack(event.track, remoteStream);
  if(document.getElementById(""+user)==null){
  var newVideo=document.createElement("video")
  newVideo.setAttribute("autoplay","true")
  newVideo.setAttribute("playinline","true")
  newVideo.className="remoteVideoConnected"
  newVideo.id=`${user}`
  newVideo.srcObject = remoteStream
  document.getElementById("video-grid").appendChild(newVideo)

  }
  else{
    document.getElementById(""+user).srcObject=remoteStream
  }
})}


signaling.onopen =async (data) => {
  console.log("connected...");
  console.log(data);

  // signal - is used to make a room (lobby)
  await send({type:"enterlobby",roomId})

  // signal - a request for all concurrent users in current lobby
  await send({type:"users",roomId})

};


// function to share info about ICE stun servers
function handleCandidate(pc){
  pc.onicecandidate = async ({ candidate }) =>{
    if(candidate!=null) await send({ type:"candidate",candidate,roomId,userId });
}
}

// click event for local-video
let localCam = document.getElementById('camera')
localCam.onclick = function(){
  let mediaStream = document.getElementById('local-video').srcObject
  mediaStream.getVideoTracks()[0].enabled =
   !(mediaStream.getVideoTracks()[0].enabled);
}


// click event for mic
let localMic = document.getElementById('mic')
localMic.onclick = function(){
  let mediaStream = document.getElementById('local-video').srcObject
  mediaStream.getAudioTracks()[0].enabled =
   !(mediaStream.getAudioTracks()[0].enabled);
}


// click event for disconnect button
let disconnectBtn = document.getElementById("disconnect")
disconnectBtn.addEventListener('click',async () => {
  console.log('local disconnect signal')
  await send({type:'disconnect',userId,roomId})
  window.location.href = window.location.origin // "www.google.com/pics /images /video /youtube"
})


// Click event for Connect Button
// It sends offer to all the connected users
let callBtn=document.getElementById("connect")
callBtn.addEventListener("click", async () => {
  
    console.log("clicked")
    // just to make sure new users are also connected
    await send({type:"users",roomId})

    console.log(roomUsers)

    for(let i=0;i<roomUsers.length;i++){
      if(roomUsers[i]!=userId){
        handleOffer(roomUsers[i])
    }
  } 
})


// function to set LocalDescription and Send Offer
async function handleOffer(i){
  try{
      // rtcpeerconnection -> remote desc and local desc
      // offer -> initiating connection peers
      // offer contains info about ip , video constraints and encryption 
      
      if(peers[i]["con"].localDescription==null && peers[i]['con'].remoteDescription==null){
        var offer = await peers[i]["con"].createOffer()
        await peers[i]["con"].setLocalDescription(new RTCSessionDescription (offer))
        console.log(`set local for ${i}`)
      
        // send the offer to the other peer
        await send({ offer: new RTCSessionDescription(offer),type:'offer',roomId, userA : i ,userB:userId});
      }else{
        console.log('already connected')
      }
    }
    catch (err) {
      console.error(err);
    }
  }


  async function connectOtherUsers(){

    await send({type:"users",roomId})
    var userList = roomUsers.reverse()
    let i = roomUsers.indexOf(userId)+1
    for(;i<roomUsers.length;i++){
      if(roomUsers[i]!=userId){
        console.log("connectOthers"+i)
        handleOffer(roomUsers[i])
    }
  }
}

// incoming messages from server (websocket)
signaling.addEventListener('message',async (msg) => {
  var data = JSON.parse(msg.data);
  try {

      // for userId
      if(data.type==="creds"){
         userId=data.userId
      }

      // for All connected users
      else if(data.type==="users"){
        roomUsers=[...data.users]
        console.log(roomUsers)
        for(let i=0;i<roomUsers.length;i++){
           let user=roomUsers[i]
          if(peers.hasOwnProperty(user)==false && user!=userId){
             peers[user]={}
             peers[user].con = new RTCPeerConnection(config)
             peers[user].track = "none"
             await handleCandidate(peers[user]["con"])
             await handleTrack(peers[user]["con"],user)
             await start(peers[user]["con"])
          }
          else if(user==userId && roomUsers.length==1) await start("")
        }
        
      }

      // Respoing to an incoming offer with an answer
      else if(data.type === "offer") {

        if(peers[data.userB]["con"].remoteDescription==null && peers[data.userB]["con"].localDescription==null){
        await peers[data.userB]["con"].setRemoteDescription(new RTCSessionDescription(data.offer));
        //const stream = await navigator.mediaDevices.getUserMedia(constraints);
        var answer = await peers[data.userB]["con"].createAnswer()
        if(peers[data.userB]["con"].localDescription==null){
          await peers[data.userB]["con"].setLocalDescription(new RTCSessionDescription(answer))
        }
        // console.log(data)
        await send({ answer: new RTCSessionDescription(answer),type:'answer',roomId,userA:data.userB,userB:userId});
        
        // console.log("offer signal")
        // console.log(data.offer)
      }
      
      } 
      
      
      // Handling Incoming answer to Our Offer
      else if (data.type === "answer") {
        // console.log("answer")
        if(peers[data.userB]["con"].remoteDescription==null){
        await peers[data.userB]["con"].setRemoteDescription(await new RTCSessionDescription(data.answer));
        
        // console.log("answer signal")
        // console.log(data.answer)
        }
      } 

    // STUN share Info
     else if (data.type==="candidate") {
       if(peers[data.userId]["con"].remoteDescription!=null){
        peers[data.userId]["con"].addIceCandidate(new RTCIceCandidate(data.candidate));
        // console.log("candidate signal")
        // console.log(data.candidate)
       }
        
      }

      // Handling Disconnected Users in A room
      else if (data.type === 'disconnect'){
        if(peers.hasOwnProperty(data.userId)){
          var parent = document.getElementById('video-grid')
          var node =document.getElementById(""+data.userId) 
          parent.removeChild(node)
          peers[data.userId]["con"].close()
          delete peers[data.userId]
        }
      }
    }
  catch (err) {
    console.error(err);
  }
  }
)








