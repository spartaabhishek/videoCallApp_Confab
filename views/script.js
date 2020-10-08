// "use strict";

// const mediaStreamConstraints = {
//   video: true,
//   audio: false,
// };

// const localVideo = document.querySelector("video");

// let localStream;

// function gotLocalMediaStream(mediaStream) {
//   localStream = mediaStream;
//   localVideo.srcObject = mediaStream;
// }

// function handleLocalMediaStreamError(error) {
//   console.log("navigator.getUserMedia error: ", error);
// }

// navigator.mediaDevices
//   .getUserMedia(mediaStreamConstraints)
//   .then(gotLocalMediaStream)
//   .catch(handleLocalMediaStreamError);



// cope with browser differences
let audioContext;
if (typeof AudioContext === 'function') {
  audioContext = new AudioContext();
} else if (typeof webkitAudioContext === 'function') {
  audioContext = new webkitAudioContext(); // eslint-disable-line new-cap
} else {
  console.log('Sorry! Web Audio not supported.');
}

// create a filter node
var filterNode = audioContext.createBiquadFilter();
// see https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#BiquadFilterNode-section
filterNode.type = 'highpass';
// cutoff frequency: for highpass, audio is attenuated below this frequency
filterNode.frequency.value = 10000;

// create a gain node (to change audio volume)
var gainNode = audioContext.createGain();
// default is 1 (no change); less than 1 means audio is attenuated
// and vice versa
gainNode.gain.value = 0.5;



var url = location.origin.replace(/^http/, 'ws')
const signaling = new WebSocket(url);
const constraints = {video: true,audio: true};
var dataConstraint = null;
var userId=""
var roomId=window.location.href.substring(window.location.href.indexOf(location.origin)+window.location.origin.length+1)
var roomUsers=[]
// var configuration = { 
//   "iceServers": [{ "url": "stun:stun.stunprotocol.org" }] 
// };

const config = {
  'iceServers': [
      { url: 'stun:stun1.l.google.com:19302' },
      {
          url: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
      }
  ]
}
// const config = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
//const pc = new RTCPeerConnection(config);
//sendChannel = pc.createDataChannel("sendDataChannel", dataConstraint);
const peers ={}
async function send(message) { 
  console.log(message)
  await signaling.send(JSON.stringify(message)); 
};

//local video element
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


//pc.onaddstream = (track) => {
  // don't set srcObject again if it is already set.

  function handleTrack(pc){
  pc.addEventListener('track', async (event) => {
  var remoteStream=new MediaStream()
  remoteStream.addTrack(event.track, remoteStream);

  var newVideo=document.createElement("video")
  newVideo.setAttribute("autoplay","true")
  newVideo.setAttribute("playinline","true")
  newVideo.className="remoteVideoConnected"
  newVideo.srcObject = remoteStream
  document.getElementById("video-grid").appendChild(newVideo)
})}


signaling.onopen =async (data) => {
  console.log("connected...");
  console.log(data);

  await send({type:"enterlobby",roomId})
  await send({type:"users",roomId})

};

function handleCandidate(pc){
  pc.onicecandidate = async ({ candidate }) =>{
    if(candidate!=null) await send({ type:"candidate",candidate,roomId,userId });
}
}

// pc.onnegotiationneeded = async () => {
//   try {

//     await pc.setLocalDescription(await pc.createOffer());
//     // send the offer to the other peer
//     send({type:'offer',offer: pc.localDescription});
//   } catch (err) {
//     console.error(err);
//   }
// };

// let the "negotiationneeded" event trigger offer generation
let callBtn=document.getElementById("connect")
callBtn.addEventListener("click", async () => {
  
    console.log("clicked")
    await send({type:"users",roomId})
    console.log(roomUsers)
    for(let i=0;i<roomUsers.length;i++){
      if(roomUsers[i]!=userId){
        handleOffer(roomUsers[i])
    }
  } 
})

async function handleOffer(i){
  try{

      var offer = await peers[i]["con"].createOffer()
      if(peers[i]["con"].localDescription==null){
        await peers[i]["con"].setLocalDescription(new RTCSessionDescription (offer))
        console.log(`set local for ${i}`)
      }
      // send the offer to the other peer
      await send({ offer: new RTCSessionDescription(offer),type:'offer',roomId, userA : i ,userB:userId});
    }
    catch (err) {
      console.error(err);
    }
  }

// isOpen(signaling);


//var selfView = document.getElementById("local-video");
// once remote track media arrives, show it in remote video element


// call start() to initiate




signaling.addEventListener('message',async (msg) => {
  var data = JSON.parse(msg.data);
  try {

    // if(users){
    //   if(users>0){
    //   console.log("lobby requested")
    //   await pc.setLocalDescription(await pc.createOffer());
    //   // send the offer to the other peer
    //   signaling.send({ desc: pc.localDescription });
    //   }
    //   else{
    //     console.log("no lobby")
    //   }
    // }

      // if we get an offer, we need to reply with an answer

      if(data.type==="creds"){
         userId=data.userId
      }

      else if(data.type==="users"){
        roomUsers=[...data.users]
        console.log(roomUsers)
        for(let i=0;i<roomUsers.length;i++){
           let user=roomUsers[i]
          if(!peers.hasOwnProperty(user) && user!=userId){
             peers[user]={}
             peers[user].con = new RTCPeerConnection(config)
             peers[user].track = "none"
             await handleCandidate(peers[user]["con"])
             await handleTrack(peers[user]["con"])
             await start(peers[user]["con"])
          }
          else if(user==userId && roomUsers.length==1) await start("")
        }
        
      }

      else if(data.type === "offer") {

        await peers[data.userB]["con"].setRemoteDescription(new RTCSessionDescription(data.offer));
        //const stream = await navigator.mediaDevices.getUserMedia(constraints);
        var answer = await peers[data.userB]["con"].createAnswer()
        if(peers[data.userB]["con"].localDescription==null){
          await peers[data.userB]["con"].setLocalDescription(new RTCSessionDescription(answer))
        }
        console.log(data)
        await send({ answer: new RTCSessionDescription(answer),type:'answer',roomId,userA:data.userB,userB:userId});
        console.log("offer signal")
        console.log(data.offer)
        //sendChannel.send(selfView.value);
      } else if (data.type === "answer") {
        console.log("answer")
        
        await peers[data.userB]["con"].setRemoteDescription(await new RTCSessionDescription(data.answer));
        console.log("answer signal")
        console.log(data.answer)
        
      } 
     else if (data.type==="candidate") {
        peers[data.userId]["con"].addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("candidate signal")
        console.log(data.candidate)
        
      }
    }
  catch (err) {
    console.error(err);
  }
  }
)


// const localConnection = new RTCPeerConnection(servers);
// const remoteConnection = new RTCPeerConnection(servers);
// const sendChannel =
//   localConnection.createDataChannel('sendDataChannel');

// ...

// remoteConnection.ondatachannel = (event) => {
//   receiveChannel = event.channel;
//   receiveChannel.onmessage = onReceiveMessage;
//   receiveChannel.onopen = onReceiveChannelStateChange;
//   receiveChannel.onclose = onReceiveChannelStateChange;
// };

// function onReceiveMessage(event) {
//   document.querySelector("textarea#send").value = event.data;
// }

// document.querySelector("button#send").onclick = () => {
//   var data = document.querySelector("textarea#send").value;
//   sendChannel.send(data);
// };






