#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    sync::{Arc, Mutex},
    sync::atomic::{AtomicBool, Ordering},
};

use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter, State};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};

struct WsState {
    sender: Mutex<Option<
        futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>
            >,
            Message
        >
    >>,
    open: Arc<AtomicBool>,
}

#[tauri::command]
async fn start(app: AppHandle, state: State<'_, WsState>) -> Result<(), String> {
    let key = env::var("DEEPGRAM_API_KEY").map_err(|_| "Missing API key")?;

    let mut req = "wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&encoding=linear16&sample_rate=16000"
        .into_client_request()
        .unwrap();

    req.headers_mut().insert(
        "Authorization",
        format!("Token {}", key).parse().unwrap(),
    );

    let (ws, _) = connect_async(req).await.map_err(|e| e.to_string())?;
    let (write, mut read) = ws.split();

    *state.sender.lock().unwrap() = Some(write);
    state.open.store(true, Ordering::SeqCst);

    let app_handle = app.clone();
    let open_flag = state.open.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(msg) = read.next().await {
            if let Ok(Message::Text(text)) = msg {
                let _ = app_handle.emit("transcript", text);
            }
        }
        open_flag.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[tauri::command]
async fn audio(data: Vec<i16>, state: State<'_, WsState>) -> Result<(), String> {
    if !state.open.load(Ordering::SeqCst) {
        return Ok(());
    }

    // 1️⃣ Take sender OUT (no await while locked)
    let mut sender = {
        let mut guard = state.sender.lock().unwrap();
        guard.take()
    };

    // 2️⃣ Await safely
    if let Some(ref mut ws) = sender {
        let _ = ws
            .send(Message::Binary(bytemuck::cast_slice(&data).to_vec()))
            .await;
    }

    // 3️⃣ Put it back
    *state.sender.lock().unwrap() = sender;

    Ok(())
}


fn main() {
    tauri::Builder::default()
        .manage(WsState {
            sender: Mutex::new(None),
            open: Arc::new(AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![start, audio])
        .run(tauri::generate_context!())
        .expect("error running app");
}
