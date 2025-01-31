import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import * as Tone from "https://cdn.skypack.dev/tone";


const socket = io("http://localhost:3000", {
    reconnectionDelayMax: 10000
});

socket.on("connect", (connection) => {
    console.log("Connected to server");
    socket.emit("test",2)
});

socket.on("state", (state) => {
    console.log("Received state", state);
    if (state === 1) {
        startLoading();
    } else if (state === 2) {
        startActive();
    }  else if (state === 0) {
        ifActiveStartIdle();
    }
});

const globalEQ = new Tone.EQ3(0, 0, 0);
globalEQ.toDestination();

const crossFade = new Tone.CrossFade().connect(globalEQ);
const delayLoading = new Tone.Reverb({
    decay : 10,
    preDelay : 0.01
    }).toDestination();
delayLoading.wet.rampTo(0.2, 0);
const loadingFade = new Tone.CrossFade().connect(delayLoading);



const baseUrl = "audio/";
const activeCount = 3;
const activeState = new Tone.Players({
    0: baseUrl + "morningLightActive1.wav",
    1: baseUrl + "morningLightActive2.wav", 
    2: baseUrl + "morningLightActive3.wav",
}).connect(crossFade.b);

// Create an EQ3 effect
const eqIdle = new Tone.EQ3(-10, 0, -3);

const idleCount = 4;
const pitchShiftIdle = new Tone.PitchShift(12).connect(crossFade.a);
pitchShiftIdle.windowSize = 0.03;
pitchShiftIdle.wet.rampTo(0, 0);
const idleState = new Tone.Players({
    0: baseUrl + "morningLightIdle1.wav",
    1: baseUrl + "morningLightIdle2.wav", 
    2: baseUrl + "morningLightIdle3.wav",
    3: baseUrl + "morningLightIdle4.wav",
}).connect(eqIdle);

eqIdle.connect(pitchShiftIdle);


const loadingState = new Tone.Player(baseUrl + "morningLightLoadingV2.wav").connect(loadingFade.a);

let curPlayer = null;

const boom = new Tone.Player("audio/shortBang.wav").toDestination();
boom.volume.value = -12; // Lower the volume by 12 decibels

crossFade.fade.value = 0;
loadingFade.fade.value = 0;

let globalState = "idle";

// Check if the browser allows audio playback
if (Tone.context.state === "running") {
    playAudio();
}

function getRandomIdleIndex() {
    return Math.floor(Math.random() * idleCount);
}

function getRandomActiveIndex(){
    return Math.floor(Math.random() * activeCount);
}

// Function to play the audio
function playAudio() {
    Tone.start().then(() => {
        startIdle();
    });
}

function ifActiveStartIdle() {
    if (globalState === "active") {
        startIdle(10);
    }
}

function startActive() {
    console.log("Start active")
    if (activeState.state === "started") {
        console.log("active state is stopping")
        try {
            activeState.stopAll();
        } catch (error) {
            console.log("ERROR");
            showAllStatesOfAllPlayers();
            console.log(activeState);
            console.log(error);
        }
        
    }

    delayLoading.wet.rampTo(1, 0.5);
    
    loadingFade.fade.rampTo(1, 1);

    const activeIndex = getRandomActiveIndex() + "";
    activeState.fadeIn = 1;
    activeState.player(activeIndex).start();
    setState("active");
    curPlayer = activeState.player(activeIndex);
    activeState.player(activeIndex).onstop = () => {
        console.log(activeState.player(activeIndex))
        activeState.player(activeIndex).onstop = () => {};
        if (idleState.state !== "started" && globalState === "active") {
            startIdle();
        }
    };
}

let prevIdleIndex = null;

function startIdle(fadeTime = 0.2) {
    setGlobalEQ() 
    console.log("Start idle");
    if (prevIdleIndex !== null) {
        idleState.player(prevIdleIndex).onstop = () => {};
    }

    
    if (loadingState.state === "started") {
        console.log("Loading state is stopping")
        loadingState.stop();
    }

    
    if (idleState.state === "started") {
        console.log("idle state is stopping");
        console.log(idleState.state);
        try {
            idleState.stopAll();
        } catch (error) {
            console.log("ERROR");
            showAllStatesOfAllPlayers();
            console.log(idleState);
            console.log(error);
        }
    }
    crossFade.fade.rampTo(0, fadeTime); 

    let idleIndex;

    do {
        idleIndex = getRandomIdleIndex() + "";
    } while (idleIndex === prevIdleIndex);
    
    prevIdleIndex = idleIndex;
    curPlayer = idleState.player(idleIndex);
    curPlayer.start();
    setState("idle");
    

    idleState.player(idleIndex).onstop = () => {
        if (globalState === "idle") {
            console.log("loop new idle");
            console.log(curPlayer)
            if (idleState.state !== "started") {
                idleState.player(idleIndex).onstop = () => {};
                startIdle();
            }
            
        }
    };
}


function startLoading() {
    console.log("Start loading")
    setState("loading");
    if (activeState.state === "started") {
        console.log("active state is stopping")
        try {
            activeState.stopAll();
        } catch (error) {
            console.log("ERROR");
            showAllStatesOfAllPlayers();
            console.log(activeState);
            console.log(error);
        }
    }
    boom.start();
    delayLoading.wet.rampTo(0,0);
    loadingFade.fade.value = 0;
    loadingState.start();
    crossFade.fade.rampTo(1, 1); // Fade to active (which is not playing) over 1 second
    loadingState.loop = true;
}


// Function to handle crossfade
function handleCrossfade(event) {
    const value = parseFloat(event.target.value);
    crossFade.fade.value = value;
}

// Add event listener to the crossfade slider
document.getElementById('crossfadeSlider').addEventListener('input', handleCrossfade);

function setState(state) {
    document.getElementById('state').innerText = state;
    globalState = state; 
}


const slider = document.getElementById('playheadSlider');

function startIdleSpace() {
    console.log(curPlayer)
    const duration = curPlayer.buffer.duration;
    const position = duration * (slider.value / 100);
    curPlayer.start(0, position);
}

slider.addEventListener('input', startIdleSpace);
document.getElementById("playButton").addEventListener("click", playAudio);
document.getElementById("activeButton").addEventListener("click", startActive);
document.getElementById("loadingButton").addEventListener("click", startLoading);
document.getElementById("idleButton").addEventListener("click", startIdle);


function showAllStatesOfAllPlayers() {
    console.log("active state");
    for (let i = 0; i < activeCount; i++) {
        console.log("Active PLAYER " + i);
        console.log(activeState.player(i + "").state);
    }
    console.log("idle state");
    for (let i = 0; i < idleCount; i++) {
        console.log("Idle PLAYER " + i);
        console.log(idleState.player(i + "").state);
    }
}

function setGlobalEQ() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const max = -15
    let value = ((hours * 60 + minutes/100)/1140) * max;
    value = Math.max(value, max);
    console.log(value)
    globalEQ.high.rampTo(value * 4, 0.1);
    globalEQ.highFrequency.rampTo(20000 + value * 800, 0.1);
    console.log(globalEQ.highFrequency.value);
}
document.getElementById('globalEq').addEventListener('input', setGlobalEQ);