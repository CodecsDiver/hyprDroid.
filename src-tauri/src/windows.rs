use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::errors::AppError;

pub const LAB_WINDOW_LABEL: &str = "lab";
pub const SOLUTION_WINDOW_LABEL: &str = "solution";

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

fn open_or_focus(app: &AppHandle, label: &str, title: &str, size: (f64, f64), min_size: (f64, f64)) -> Result<(), AppError> {
    if let Some(existing) = app.get_webview_window(label) {
        existing.show().map_err(|error| AppError::new("window", error.to_string()))?;
        existing.set_focus().map_err(|error| AppError::new("window", error.to_string()))?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(size.0, size.1)
        .min_inner_size(min_size.0, min_size.1)
        .decorations(false)
        .build()
        .map_err(|error| AppError::new("window", error.to_string()))?;
    Ok(())
}

/// Opens (or focuses) the Visualizer Lab. The frontend picks its view from the window label.
#[tauri::command]
pub fn open_lab_window(app: AppHandle) -> Result<(), AppError> {
    open_or_focus(&app, LAB_WINDOW_LABEL, "Python Discovery - Visualizer Lab", (1240.0, 820.0), (860.0, 560.0))
}

/// Opens (or focuses) the Solution window. Which mission it shows is shared through the `practice` document.
#[tauri::command]
pub fn open_solution_window(app: AppHandle) -> Result<(), AppError> {
    open_or_focus(&app, SOLUTION_WINDOW_LABEL, "Python Discovery - Solution", (980.0, 860.0), (640.0, 480.0))
}
