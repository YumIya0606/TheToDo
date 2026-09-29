#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::Command;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, Code, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn spawn_external_terminal(executor: String, path: String, command: String) -> Result<bool, String> {
    let result = match executor.as_str() {
        "cmd" => {
            Command::new("cmd.exe")
                .args(&["/c", "start", "cmd.exe", "/k", &format!("cd /d \"{}\" && {}", path, command)])
                .spawn()
        },
        "powershell" => {
            Command::new("powershell.exe")
                .args(&[
                    "-NoExit", 
                    "-Command", 
                    &format!("Set-Location -Path '{}'; {}", path, command)
                ])
                .spawn()
        },
        _ => return Err("Invalid executor specified".to_string()),
    };

    match result {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to launch terminal: {}", e)),
    }
}

#[tauri::command]
fn execute_native_script(executor: String, script_path: String, args: Vec<String>) -> Result<String, String> {
    let mut cmd = if executor == "powershell" {
        let mut c = Command::new("powershell");
        c.arg("-ExecutionPolicy").arg("Bypass").arg("-NoProfile").arg("-File").arg(&script_path);
        c
    } else {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(&script_path);
        c
    };

    for arg in args {
        cmd.arg(arg);
    }

    match cmd.spawn() {
        Ok(_) => Ok("Script launched natively".to_string()),
        Err(e) => Err(format!("Failed to launch: {}", e))
    }
}

#[tauri::command]
fn run_native_script(executor: String, script_path: String) -> Result<String, String> {
    let mut cmd = if executor == "powershell" {
        let mut c = std::process::Command::new("powershell");
        c.arg("-ExecutionPolicy").arg("Bypass").arg("-NoProfile").arg("-File").arg(&script_path);
        c
    } else {
        let mut c = std::process::Command::new("cmd");
        c.arg("/C").arg(&script_path);
        c
    };

    match cmd.spawn() {
        Ok(_) => Ok("Success".to_string()),
        Err(e) => Err(e.to_string())
    }
}

/// Quick Capture overlay geometry (logical px).
/// Mini mode is a small floating shape; expanded mode is the full menu.
/// Both anchor at the top-right, sitting *under* where most apps draw their
/// window close button, so the shape never covers app chrome.
const QC_MINI_W: f64 = 44.0;
const QC_MINI_H: f64 = 44.0;
const QC_FULL_W: f64 = 380.0;
const QC_FULL_H: f64 = 460.0;
/// Gap from the screen's right edge, and how far below the top edge the shape
/// floats (below the ~40px title-bar close-button strip of a maximized app).
const QC_RIGHT_GAP: f64 = 18.0;
const QC_TOP_GAP: f64 = 58.0;

/// Position the overlay window at its anchored spot for the given size.
fn place_qc(window: &tauri::WebviewWindow, w: f64, h: f64) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("no current monitor")?;
    let scale = monitor.scale_factor();
    let mon_w = monitor.size().width as f64 / scale;
    // The right edge is the monitor's own right edge; the shape floats just
    // inside it, low enough to clear a maximized app's close-button strip.
    let x = mon_w - w - QC_RIGHT_GAP;
    let y = QC_TOP_GAP;
    window
        .set_size(tauri::LogicalSize::new(w, h))
        .map_err(|e| e.to_string())?;
    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Show the overlay as the mini floating shape (the "seed" form). Emits
/// `qc-mini` so the webview resets its menu state even if the shortcut was
/// pressed while the full menu was open.
fn show_qc_mini(window: &tauri::WebviewWindow) -> Result<(), String> {
    place_qc(window, QC_MINI_W, QC_MINI_H)?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    let _ = window.emit("qc-mini", ());
    Ok(())
}

/// Hide the overlay, resetting it to the mini form for next time.
fn hide_qc(window: &tauri::WebviewWindow) -> Result<(), String> {
    let _ = window.emit("qc-mini", ());
    window.hide().map_err(|e| e.to_string())
}

/// Toggle the quick-capture overlay: hidden → mini shape, visible → hidden.
#[tauri::command]
fn toggle_quick_capture(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("quick-capture")
        .ok_or("quick-capture window not found")?;
    if window.is_visible().unwrap_or(false) {
        hide_qc(&window)?;
    } else {
        show_qc_mini(&window)?;
    }
    Ok(())
}

/// Expand the mini shape into the full menu at the very same anchor point.
#[tauri::command]
fn expand_quick_capture(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("quick-capture")
        .ok_or("quick-capture window not found")?;
    place_qc(&window, QC_FULL_W, QC_FULL_H)?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Collapse back to the mini floating shape. Skipped while hidden, so a
/// collapse racing with a hide can never surface a blank window. Focus is left
/// untouched: a click-away dismissal must not yank focus back from the app the
/// user moved to.
#[tauri::command]
fn collapse_quick_capture(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("quick-capture")
        .ok_or("quick-capture window not found")?;
    if !window.is_visible().unwrap_or(false) {
        return Ok(());
    }
    place_qc(&window, QC_MINI_W, QC_MINI_H)?;
    Ok(())
}

/// Port the reading engine listens on, kept in one place so the webview never
/// needs to know it.
#[derive(Clone)]
pub struct EnginePort(pub u16);

/// Read ClassRadar's exported schedule.
///
/// Done in Rust rather than through the fs plugin on purpose: Tauri v2's fs
/// scope is deliberately narrow, and widening it to let the webview read a file
/// in another app's data directory would hand the frontend far more filesystem
/// access than this feature needs. A command keeps the permission to exactly one
/// file, with the path validated here.
#[tauri::command]
fn read_classradar_schedule(export_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&export_path);

    // Only ever read a file that is actually a schedule export, so a mistyped
    // setting cannot turn this into a general file read.
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    if !name.eq_ignore_ascii_case("schedule.json") {
        return Err(format!(
            "Refusing to read '{name}': expected a ClassRadar schedule export named schedule.json"
        ));
    }

    match std::fs::read_to_string(path) {
        Ok(text) => Ok(text),
        Err(e) => Err(format!(
            "Could not read {export_path}: {e}. In ClassRadar, press Export schedule."
        )),
    }
}

/// Launch the engine as a plain child process.
///
/// A Tauri sidecar needs a bundled binary per platform, which is not built yet.
/// Spawning the Node bundle directly does the same job for a student running
/// this on their own machine, which is the only case that matters today, and it
/// keeps the failure message specific when Node is not installed.
#[tauri::command]
fn engine_launch(engine_path: String, port: u16, data_dir: String) -> Result<u32, String> {
    use std::process::{Command, Stdio};

    if !std::path::Path::new(&engine_path).exists() {
        return Err(format!("No engine at {engine_path}"));
    }

    let child = Command::new("node")
        .arg(&engine_path)
        .env("CLASSRADAR_PORT", port.to_string())
        .env("CLASSRADAR_DATA_DIR", &data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!(
                "Could not start the engine: {e}. Node needs to be installed and on the PATH."
            )
        })?;

    Ok(child.id())
}

/// Where ClassRadar is expected to live, so the default path is not a guess.
#[tauri::command]
fn classradar_default_path() -> String {
    let base = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME").map_err(|_| "?").map(|h| h.to_string()))
        .unwrap_or_default();
    format!("{base}/ClassRadar/data/schedule.json")
}

/// Talk to the reading engine (ClassRadar) from Rust.
///
/// The engine stays a separate process on its own port. Forwarding through a
/// command keeps the URL and the port in one place, means the webview never
/// needs a CORS exemption or to know where the engine is, and gives a single
/// place to answer "is it even running?".
#[tauri::command]
async fn engine_request(
    state: tauri::State<'_, EnginePort>,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<String, String> {
    if path.starts_with('/') || path.contains("..") {
        return Err("Bad engine path".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{}{}", state.0, path);
    let m = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|e| format!("Bad method: {e}"))?;

    let mut req = client.request(m, &url);
    if let Some(b) = body {
        req = req
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(b);
    }

    let res = req
        .send()
        .await
        .map_err(|e| format!("The reading engine is not reachable on port {}: {e}", state.0))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Engine said {status}: {text}"));
    }
    Ok(text)
}

/// Whether anything is listening for the engine, so the UI can say so plainly
/// instead of every panel failing with a connection error.
#[tauri::command]
async fn engine_alive(state: tauri::State<'_, EnginePort>) -> Result<bool, String> {
    Ok(reqwest::Client::new()
        .get(format!("http://127.0.0.1:{}/api/health", state.0))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false))
}

/// Start the engine as a child process, so the student does not have to run a
/// second app by hand. The path is where the engine's bundle lives.
#[tauri::command]
async fn engine_start(app: tauri::AppHandle, engine_path: String) -> Result<u32, String> {
    let sidecar = tauri_plugin_shell::ShellExt::shell(&app)
        .sidecar("classradar-engine")
        .map_err(|e| {
            format!(
                "The engine sidecar is not bundled with this build ({e}). Run it yourself, or use \
                 a path in Settings."
            )
        })?;
    let (mut rx, _child) = sidecar
        .spawn()
        .map_err(|e| format!("Could not start the engine from {engine_path}: {e}"))?;
    // Reading one event confirms the process is actually up, rather than
    // returning a pid for something that immediately died.
    let _ = rx.recv().await;
    Ok(0)
}

fn main() {
    // Global shortcut: Ctrl+Shift+X toggles the Quick Capture overlay from anywhere.
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyX);

    tauri::Builder::default()
        .plugin(
            ShortcutBuilder::new()
                .with_shortcut(shortcut)
                .expect("failed to register Ctrl+Shift+X shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("quick-capture") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = show_qc_mini(&window);
                            }
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            spawn_external_terminal,
            execute_native_script,
            run_native_script,
            toggle_quick_capture,
            expand_quick_capture,
            collapse_quick_capture,
            read_classradar_schedule,
            classradar_default_path,
            engine_request,
            engine_alive,
            engine_start,
            engine_launch
        ])
        .manage(EnginePort(std::env::var("CLASSRADAR_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(5188)))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

