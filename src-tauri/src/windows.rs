use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::errors::AppError;

pub const LAB_WINDOW_LABEL: &str = "lab";

const THEME_SITE_URL: &str = "https://colorthemepark.netlify.app";

/// Opens the colour tool in the system browser. The address is fixed, so no frontend input reaches the command line.
#[tauri::command]
pub fn open_theme_site() -> Result<(), AppError> {
    std::process::Command::new("xdg-open")
        .arg(THEME_SITE_URL)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| AppError::new("window", format!("could not open the browser: {error}")))
}

/// Opens (or focuses) the Visualizer Lab. The frontend picks its view from the window label.
#[tauri::command]
pub fn open_lab_window(app: AppHandle) -> Result<(), AppError> {
    if let Some(existing) = app.get_webview_window(LAB_WINDOW_LABEL) {
        existing.show().map_err(|error| AppError::new("window", error.to_string()))?;
        existing.set_focus().map_err(|error| AppError::new("window", error.to_string()))?;
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, LAB_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("Python Discovery - Visualizer Lab")
        .inner_size(1240.0, 820.0)
        .min_inner_size(860.0, 560.0)
        .decorations(false)
        .build()
        .map_err(|error| AppError::new("window", error.to_string()))?;
    Ok(())
}
