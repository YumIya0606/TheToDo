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
            collapse_quick_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

