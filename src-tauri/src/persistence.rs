use std::{fs, io::Write, path::{Path, PathBuf}};

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::errors::AppError;

const ALLOWED_DOCUMENT_NAMES: [&str; 5] = ["settings", "progression", "theme", "practice", "typscryption"];

pub fn app_data_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::new("storage", error.to_string()))?;
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

/// Writes through a temporary sibling file and renames it into place, so a crash
/// mid-write never leaves a truncated target.
pub fn write_atomically(target: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::new("unsafe-path", "target has no file name"))?;
    let temporary_path = target.with_file_name(format!(".{file_name}.tmp"));

    let mut file = fs::File::create(&temporary_path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(&temporary_path, target)?;
    Ok(())
}

fn resolve_document_path(app: &AppHandle, name: &str) -> Result<PathBuf, AppError> {
    if !ALLOWED_DOCUMENT_NAMES.contains(&name) {
        return Err(AppError::new("storage", format!("unknown document: {name}")));
    }
    Ok(app_data_directory(app)?.join(format!("{name}.json")))
}

#[tauri::command]
pub fn load_document(app: AppHandle, name: String) -> Result<Option<Value>, AppError> {
    let path = resolve_document_path(&app, &name)?;
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(serde_json::from_str(&text)?)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command]
pub fn save_document(app: AppHandle, name: String, value: Value) -> Result<(), AppError> {
    let path = resolve_document_path(&app, &name)?;
    write_atomically(&path, serde_json::to_string_pretty(&value)?.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_existing_content_and_leaves_no_temporary_file() {
        let directory = std::env::temp_dir().join(format!("pydisc-atomic-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        let target = directory.join("note.json");

        write_atomically(&target, b"first").unwrap();
        write_atomically(&target, b"second").unwrap();

        assert_eq!(fs::read_to_string(&target).unwrap(), "second");
        assert!(!directory.join(".note.json.tmp").exists());
        fs::remove_dir_all(&directory).unwrap();
    }
}
