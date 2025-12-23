const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

let audioContext;
let stream;
let source;
let worklet;
let recording = false;
let socketOpen = false;

const finalEl = document.getElementById("final");
const partialEl = document.getElementById("partial");

let finalText = "";
let partialText = "";
let silenceTimer = null;

const SILENCE_MS = 800;

function finalizePartial() {
  if (!partialText.trim()) return;

  finalText += partialText.trim() + " ";
  finalEl.textContent = finalText;
  partialEl.textContent = "";
  partialText = "";
}

function onTranscript(msg) {
  if (msg.type === "partial") {
    partialText = msg.text;
    partialEl.textContent = partialText;

    // reset silence timer
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(finalizePartial, SILENCE_MS);
  }

  if (msg.type === "final") {
    if (silenceTimer) clearTimeout(silenceTimer);

    finalText += msg.text.trim() + " ";
    finalEl.textContent = finalText;
    partialEl.textContent = "";
    partialText = "";
  }
}

/* hook this to your websocket / backend */
window.handleTranscript = onTranscript;



/* ---------------- LISTEN FOR TRANSCRIPTS ---------------- */

listen("transcript", (event) => {
  const data = JSON.parse(event.payload);

  const alt = data.channel?.alternatives?.[0];
  if (!alt) return;

  if (data.is_final) {
    finalEl.textContent += alt.transcript + " ";
    partialEl.textContent = "";
  } else {
    partialEl.textContent = alt.transcript;
  }
});

/* ---------------- START ---------------- */

async function startRecording() {
  if (recording) return;

  recording = true;
  socketOpen = true;

  await invoke("start");

  stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, sampleRate: 16000 }
  });

  audioContext = new AudioContext({ sampleRate: 16000 });
  await audioContext.audioWorklet.addModule("./audio-processor.js");

  source = audioContext.createMediaStreamSource(stream);
  worklet = new AudioWorkletNode(audioContext, "mic-processor");

  worklet.port.onmessage = (e) => {
    if (!recording || !socketOpen) return;

    const floatData = e.data;
    const pcm = new Int16Array(floatData.length);

    for (let i = 0; i < floatData.length; i++) {
      pcm[i] = Math.max(-1, Math.min(1, floatData[i])) * 32767;
    }

    invoke("audio", { data: Array.from(pcm) })
      .catch(() => socketOpen = false);
  };

  source.connect(worklet);
}

/* ---------------- STOP ---------------- */

function stopRecording() {
  recording = false;
  socketOpen = false;

  worklet?.disconnect();
  source?.disconnect();
  stream?.getTracks().forEach(t => t.stop());

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }
}

document.getElementById("start").onclick = startRecording;
document.getElementById("stop").onclick = stopRecording;
