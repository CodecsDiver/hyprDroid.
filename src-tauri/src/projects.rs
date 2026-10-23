use std::{fs, path::PathBuf};

use tauri::AppHandle;

use crate::{
    errors::AppError,
    persistence::{app_data_directory, write_atomically},
};

pub const MAX_FILE_BYTES: usize = 256 * 1024;
pub const RESERVED_CHECKS_FILE_NAME: &str = "_checks.py";
/// The file the objective tests import. It can be edited but never renamed or deleted.
pub const MAIN_FILE_NAME: &str = "main.py";

pub fn validate_project_id(project_id: &str) -> Result<(), AppError> {
    let is_valid = !project_id.is_empty()
        && project_id.len() <= 64
        && project_id
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_' || byte == b'-');
    if is_valid {
        Ok(())
    } else {
        Err(AppError::new("unknown-project", format!("invalid project id: {project_id}")))
    }
}

/// Student files must be top-level `.py` files with a plain identifier-style stem.
pub fn validate_file_name(file_name: &str) -> Result<(), AppError> {
    let reject = |reason: &str| Err(AppError::new("unsafe-path", format!("{file_name}: {reason}")));
    let Some(stem) = file_name.strip_suffix(".py") else {
        return reject("must be a top-level .py file");
    };
    let is_plain_stem = !stem.is_empty()
        && stem.len() <= 64
        && stem.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        && !stem.as_bytes()[0].is_ascii_digit();
    if !is_plain_stem {
        return reject("invalid file name");
    }
    if file_name == RESERVED_CHECKS_FILE_NAME {
        return reject("reserved file name");
    }
    Ok(())
}

pub fn project_directory(app: &AppHandle, project_id: &str) -> Result<PathBuf, AppError> {
    validate_project_id(project_id)?;
    Ok(app_data_directory(app)?.join("projects").join(project_id))
}

#[tauri::command]
pub fn list_project_files(app: AppHandle, project_id: String) -> Result<Vec<String>, AppError> {
    let directory = project_directory(&app, &project_id)?;
    let entries = match fs::read_dir(&directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.into()),
    };
    let mut file_names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| validate_file_name(name).is_ok())
        .collect();
    file_names.sort();
    Ok(file_names)
}

#[tauri::command]
pub fn read_project_file(app: AppHandle, project_id: String, file_name: String) -> Result<Option<String>, AppError> {
    validate_file_name(&file_name)?;
    let path = project_directory(&app, &project_id)?.join(&file_name);
    match fs::metadata(&path) {
        Ok(metadata) if metadata.len() as usize > MAX_FILE_BYTES => {
            Err(AppError::new("file-too-large", format!("{file_name} exceeds {MAX_FILE_BYTES} bytes")))
        }
        Ok(_) => Ok(Some(fs::read_to_string(&path)?)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command]
pub fn write_project_file(
    app: AppHandle,
    project_id: String,
    file_name: String,
    content: String,
) -> Result<(), AppError> {
    validate_file_name(&file_name)?;
    if content.len() > MAX_FILE_BYTES {
        return Err(AppError::new("file-too-large", format!("{file_name} exceeds {MAX_FILE_BYTES} bytes")));
    }
    let directory = project_directory(&app, &project_id)?;
    fs::create_dir_all(&directory)?;
    write_atomically(&directory.join(&file_name), content.as_bytes())
}

fn delete_in(directory: &std::path::Path, file_name: &str) -> Result<(), AppError> {
    validate_file_name(file_name)?;
    if file_name == MAIN_FILE_NAME {
        return Err(AppError::new("not-editable", format!("{MAIN_FILE_NAME} is checked by the missions and cannot be deleted")));
    }
    match fs::remove_file(directory.join(file_name)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn rename_in(directory: &std::path::Path, from: &str, to: &str) -> Result<(), AppError> {
    validate_file_name(from)?;
    validate_file_name(to)?;
    if from == MAIN_FILE_NAME || to == MAIN_FILE_NAME {
        return Err(AppError::new("not-editable", format!("{MAIN_FILE_NAME} cannot be renamed or replaced")));
    }
    let target = directory.join(to);
    if target.exists() {
        return Err(AppError::new("file-already-exists", format!("{to} already exists")));
    }
    fs::rename(directory.join(from), target)?;
    Ok(())
}

#[tauri::command]
pub fn delete_project_file(app: AppHandle, project_id: String, file_name: String) -> Result<(), AppError> {
    delete_in(&project_directory(&app, &project_id)?, &file_name)
}

#[tauri::command]
pub fn rename_project_file(app: AppHandle, project_id: String, from: String, to: String) -> Result<(), AppError> {
    rename_in(&project_directory(&app, &project_id)?, &from, &to)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_directory(name: &str) -> std::path::PathBuf {
        let directory = std::env::temp_dir().join(format!("pydisc-files-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        directory
    }

    #[test]
    fn rename_moves_a_file_and_refuses_to_overwrite_or_touch_main() {
        let directory = scratch_directory("rename");
        fs::write(directory.join("a.py"), "a").unwrap();
        fs::write(directory.join("b.py"), "b").unwrap();
        fs::write(directory.join("main.py"), "m").unwrap();

        rename_in(&directory, "a.py", "c.py").unwrap();
        assert_eq!(fs::read_to_string(directory.join("c.py")).unwrap(), "a");
        assert!(!directory.join("a.py").exists());

        assert_eq!(rename_in(&directory, "c.py", "b.py").unwrap_err().code, "file-already-exists");
        assert_eq!(fs::read_to_string(directory.join("b.py")).unwrap(), "b");
        assert_eq!(rename_in(&directory, "main.py", "x.py").unwrap_err().code, "not-editable");
        assert_eq!(rename_in(&directory, "c.py", "main.py").unwrap_err().code, "not-editable");
        assert_eq!(rename_in(&directory, "c.py", "../evil.py").unwrap_err().code, "unsafe-path");
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn delete_removes_files_but_never_main() {
        let directory = scratch_directory("delete");
        fs::write(directory.join("helpers.py"), "h").unwrap();
        fs::write(directory.join("main.py"), "m").unwrap();

        delete_in(&directory, "helpers.py").unwrap();
        assert!(!directory.join("helpers.py").exists());
        delete_in(&directory, "helpers.py").unwrap();
        assert_eq!(delete_in(&directory, "main.py").unwrap_err().code, "not-editable");
        assert!(directory.join("main.py").exists());
        assert_eq!(delete_in(&directory, "../main.py").unwrap_err().code, "unsafe-path");
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn accepts_plain_python_file_names() {
        assert!(validate_file_name("main.py").is_ok());
        assert!(validate_file_name("helper_2.py").is_ok());
    }

    #[test]
    fn rejects_traversal_hidden_reserved_and_non_python_names() {
        for name in ["../main.py", "a/b.py", ".hidden.py", "main.txt", "main", "9lives.py", "_checks.py", "", ".py"] {
            assert!(validate_file_name(name).is_err(), "{name} should be rejected");
        }
    }

    #[test]
    fn project_ids_are_restricted_to_slug_characters() {
        assert!(validate_project_id("hello-realm_1").is_ok());
        for id in ["", "../x", "Has Space", "UPPER", &"a".repeat(65)] {
            assert!(validate_project_id(id).is_err(), "{id} should be rejected");
        }
    }
}
