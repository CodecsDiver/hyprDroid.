use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::errors::AppError;

pub const LESSONS_WINDOW_LABEL: &str = "lessons";

/// Opens (or focuses) the Lesson Lab. The frontend picks its view from the window label.
#[tauri::command]
pub fn open_lessons_window(app: AppHandle) -> Result<(), AppError> {
    if let Some(existing) = app.get_webview_window(LESSONS_WINDOW_LABEL) {
        existing.show().map_err(|error| AppError::new("window", error.to_string()))?;
        existing.set_focus().map_err(|error| AppError::new("window", error.to_string()))?;
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, LESSONS_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("Python Discovery - Lesson Lab")
        .inner_size(1240.0, 820.0)
        .min_inner_size(860.0, 560.0)
        .decorations(false)
        .build()
        .map_err(|error| AppError::new("window", error.to_string()))?;
    Ok(())
}
