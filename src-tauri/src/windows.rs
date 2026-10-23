use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::errors::AppError;

pub const LAB_WINDOW_LABEL: &str = "lab";

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
