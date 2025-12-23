# Voice-to-Text Desktop App (Wispr-style Flow)

A lightweight desktop voice dictation application built with **Tauri + Web Audio API + Deepgram WebSocket streaming**, inspired by Wispr’s continuous background dictation experience.

---

##  Features

-  Real-time voice transcription
-  Partial (live) text + finalized text flow
-  Auto-finalization on silence (Wispr-style behavior)
-  Low-latency WebSocket audio streaming
-  Desktop app (Tauri)

---

##  Architecture Overview

**Frontend**
- Web Audio API for microphone access
- PCM audio streaming (16kHz, mono)
- Partial + final transcript UI
- Silence detection for auto-finalization

**Backend (Tauri / Rust)**
- WebSocket connection to Deepgram
- Audio chunk forwarding
- Event-based transcript streaming to frontend

Microphone
↓
Web Audio API (PCM)
↓
Tauri Command
↓
Deepgram WebSocket
↓
Transcript Events
↓
UI (Partial → Final)


---

## Setup Instructions

### 1. Prerequisites
- Node.js ≥ 18
- Rust (stable)
- Tauri CLI

'''bash
npm install -g @tauri-apps/cli

 ### 2. Clone & Install
- git clone https://github.com/YOUR_USERNAME/voice-to-text.git
- cd voice-to-text
- npm install


### 3. Environment Variable

Create a .env file or set environment variable:

'''bash
DEEPGRAM_API_KEY=your_api_key_here


### 4.Run the App

'''bash
npm run tauri dev

---

Demo video link: (add YouTube / Drive link here)







