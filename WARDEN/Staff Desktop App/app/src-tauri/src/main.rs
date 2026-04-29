// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            println!("[APP] 🚀 Initializing WARDEN Crisis Desk Dashboard...");

            // Resolve absolute paths for the executable and model
            let exe_path = app.path()
                .resolve("binaries/llama-server.exe", tauri::path::BaseDirectory::Resource)
                .unwrap_or_else(|_| app.path().resolve("llama-server.exe", tauri::path::BaseDirectory::Resource).unwrap_or_default());

            let model_path = app.path()
                .resolve("binaries/gemma-4-e2b.gguf", tauri::path::BaseDirectory::Resource)
                .unwrap_or_default();

            if !exe_path.exists() || exe_path.to_string_lossy().is_empty() {
                eprintln!("[APP] ❌ AI Server executable not found at: {:?}", exe_path);
                return Ok(()); // Stop setup but don't panic
            }
            if !model_path.exists() || model_path.to_string_lossy().is_empty() {
                eprintln!("[APP] ❌ Gemma model weights not found at: {:?}", model_path);
                return Ok(()); // Stop setup but don't panic
            }

            let model_path_str = model_path.to_string_lossy().to_string();

            // Spawn directly using standard Command to ensure DLLs in the same folder are found
            use std::process::Stdio;
            use std::io::{BufRead, BufReader};

            // Determine the directory where the executable lives (important for DLL loading)
            let exe_dir = exe_path.parent().expect("Failed to get executable directory");

            println!("[APP] 🧠 Starting local Gemma AI model (llama-server)...");
            
            #[cfg(windows)]
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let mut command = std::process::Command::new(&exe_path);
            command.current_dir(exe_dir)
                .args([
                    "-m", &model_path_str, 
                    "--port", "8080", 
                    "-c", "8192", 
                    "--host", "127.0.0.1",
                    "--alias", "gemma-4-e2b"
                ])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(CREATE_NO_WINDOW);
            }

            let mut child = command.spawn()
                .expect("Failed to spawn llama-server");

            let stdout = child.stdout.take().expect("Failed to open stdout");
            let stderr = child.stderr.take().expect("Failed to open stderr");

            // Listen to sidecar output in a background thread
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(text) = line {
                        if text.contains("HTTP server listening") {
                            println!("[APP] ✅ Gemma AI Model is ONLINE and listening on port 8080");
                        }
                        println!("[AI SIDECAR] {}", text);
                    }
                }
            });

            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(text) = line {
                        println!("[AI SIDECAR LOG] {}", text);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
