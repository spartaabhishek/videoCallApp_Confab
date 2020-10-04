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

var url = location.origin.replace(/^http/, 'ws')
const signaling = new WebSocket(url);
const constraints = {  video: true};
var dataConstraint = null;
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
const pc = new RTCPeerConnection(config);
start();
sendChannel = pc.createDataChannel("sendDataChannel", dataConstraint);

function send(message) { 
  signaling.send(JSON.stringify(message)); 
};


async function start() {
  try {
    // get local stream, show it in self-view and add it to be sent
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    pc.addStream(stream);
    selfView = document.getElementById("local-video");
    selfView.srcObject = stream;
  } catch (err) {
    console.error(err);
  }
}

pc.onaddstream = (track) => {
  // don't set srcObject again if it is already set.
  
  var newVideo=document.createElement("video")
  newVideo.setAttribute("autoplay","true")
  newVideo.setAttribute("playinline","true")
  newVideo.srcObject = track.stream;
  document.getElementById("video-grid").appendChild(newVideo)
};

pc.onicecandidate = async ({ candidate }) =>{
  if(candidate!=null)  await send({ type:"candidate",candidate });
}

// let the "negotiationneeded" event trigger offer generation
let callBtn=document.getElementById("connect")
callBtn.addEventListener("click", async () => {
  try {
    console.log("clicked")
    await pc.setLocalDescription(await pc.createOffer());
    // send the offer to the other peer
    await send({ offer: pc.localDescription,type:'offer' });
  } catch (err) {
    console.error(err);
  }
})


// isOpen(signaling);

signaling.onopen = (data) => {
  console.log("connected...");
  console.log(data);
};

//var selfView = document.getElementById("local-video");
// once remote track media arrives, show it in remote video element


// call start() to initiate





signaling.addEventListener('message',async (msg) => {
  var data = JSON.parse(msg.data);
  console.log(msg.data)
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
      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        //const stream = await navigator.mediaDevices.getUserMedia(constraints);
        await pc.setLocalDescription(await pc.createAnswer());
        await send({ answer: pc.localDescription,type:'answer' });
        console.log("offer signal")
        console.log(data.offer)
        //sendChannel.send(selfView.value);
      } else if (data.type === "answer") {
        console.log("answer")
        
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log("answer signal")
        console.log(data.answer)
        
      } 
     else if (data.type==="candidate") {

      if(pc.remoteDescription!=null && pc.localDescription!=null){
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("candidate signal")
        console.log(data.candidate)
      }
      
    }
  }
  catch (err) {
    console.error(err);
  }

})


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
