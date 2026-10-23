mod errors;
mod persistence;
mod projects;
mod runner;
mod windows;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            persistence::load_document,
            persistence::save_document,
            projects::list_project_files,
            projects::read_project_file,
            projects::write_project_file,
            runner::sandbox_status,
            runner::run_python,
            runner::run_checks,
            windows::open_lessons_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Python Discovery");
}
