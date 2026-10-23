//! Runs student Python only on explicit user action. Code runs inside bubblewrap
//! (no network, read-only system, writable project dir only) when it is usable;
//! otherwise the caller must acknowledge running with the full access of the user account.

use std::{
    ffi::OsString,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{mpsc, OnceLock},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::AppHandle;

use crate::{
    errors::AppError,
    projects::{project_directory, validate_file_name, MAX_FILE_BYTES, RESERVED_CHECKS_FILE_NAME},
};

const WALL_TIMEOUT: Duration = Duration::from_secs(10);
const OUTPUT_LIMIT_BYTES: usize = 64 * 1024;
const SANDBOX_PYTHON: &str = "/usr/bin/python3";
const PYTHON_FLAGS: [&str; 3] = ["-B", "-s", "-E"];

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Isolation {
    Bubblewrap,
    None,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunOutcome {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub output_truncated: bool,
    pub isolation: Isolation,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxStatus {
    pub python_path: Option<String>,
    pub bubblewrap_usable: bool,
}

fn find_in_path(program: &str) -> Option<PathBuf> {
    std::env::var_os("PATH")?
        .to_string_lossy()
        .split(':')
        .map(|directory| Path::new(directory).join(program))
        .find(|candidate| candidate.is_file())
}

fn find_python() -> Option<PathBuf> {
    if let Some(configured) = std::env::var_os("PYDISC_PYTHON") {
        let configured = PathBuf::from(configured);
        if configured.is_file() {
            return Some(configured);
        }
    }
    find_in_path("python3")
}

fn base_sandbox_arguments() -> Vec<OsString> {
    let mut arguments: Vec<OsString> = [
        "--unshare-all", "--die-with-parent", "--new-session", "--clearenv",
        "--ro-bind", "/usr", "/usr",
        "--symlink", "usr/bin", "/bin",
        "--symlink", "usr/sbin", "/sbin",
        "--symlink", "usr/lib", "/lib",
        "--symlink", "usr/lib64", "/lib64",
        "--ro-bind-try", "/etc/alternatives", "/etc/alternatives",
        "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
    ]
    .iter()
    .map(OsString::from)
    .collect();
    for (name, value) in [("PATH", "/usr/bin"), ("HOME", "/tmp"), ("LANG", "C.UTF-8"), ("PYTHONIOENCODING", "utf-8")] {
        arguments.extend(["--setenv", name, value].map(OsString::from));
    }
    arguments
}

fn bubblewrap_is_usable() -> bool {
    static USABLE: OnceLock<bool> = OnceLock::new();
    *USABLE.get_or_init(|| {
        let Some(bubblewrap) = find_in_path("bwrap") else { return false };
        Path::new(SANDBOX_PYTHON).is_file()
            && Command::new(bubblewrap)
                .args(base_sandbox_arguments())
                .arg("/usr/bin/true")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
    })
}

fn build_command(
    isolation: Isolation,
    python: &Path,
    work_directory: &Path,
    script_arguments: &[&str],
    extra_environment: &[(&str, &str)],
) -> Result<Command, AppError> {
    let mut command = match isolation {
        Isolation::Bubblewrap => {
            let bubblewrap = find_in_path("bwrap")
                .ok_or_else(|| AppError::new("containment-unavailable", "bubblewrap (bwrap) is not installed"))?;
            let mut command = Command::new(bubblewrap);
            command.args(base_sandbox_arguments());
            command.arg("--bind").arg(work_directory).arg("/work").args(["--chdir", "/work"]);
            for (name, value) in extra_environment {
                command.args(["--setenv", name, value]);
            }
            command.arg(SANDBOX_PYTHON).args(PYTHON_FLAGS).args(script_arguments);
            command
        }
        Isolation::None => {
            let mut command = Command::new(python);
            command
                .args(PYTHON_FLAGS)
                .args(script_arguments)
                .current_dir(work_directory)
                .env_clear()
                .env("PATH", "/usr/local/bin:/usr/bin:/bin")
                .env("HOME", work_directory)
                .env("LANG", "C.UTF-8")
                .env("PYTHONIOENCODING", "utf-8");
            for (name, value) in extra_environment {
                command.env(name, value);
            }
            command
        }
    };
    command.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    apply_resource_limits(&mut command);
    Ok(command)
}

#[cfg(unix)]
fn apply_resource_limits(command: &mut Command) {
    use std::os::unix::process::CommandExt;
    command.process_group(0);
    // SAFETY: only async-signal-safe setrlimit calls run between fork and exec.
    unsafe {
        command.pre_exec(|| {
            let limits = [
                (libc::RLIMIT_CPU, 12u64),
                (libc::RLIMIT_FSIZE, 16 * 1024 * 1024),
                (libc::RLIMIT_CORE, 0),
                (libc::RLIMIT_AS, 2 * 1024 * 1024 * 1024),
            ];
            for (resource, value) in limits {
                let limit = libc::rlimit { rlim_cur: value as libc::rlim_t, rlim_max: value as libc::rlim_t };
                libc::setrlimit(resource, &limit);
            }
            Ok(())
        });
    }
}

#[cfg(not(unix))]
fn apply_resource_limits(_command: &mut Command) {}

/// Reads up to `OUTPUT_LIMIT_BYTES`, then keeps draining so the child never blocks on a full pipe.
/// The result arrives on a channel so a leaked grandchild holding the pipe open cannot hang the caller.
fn read_capped<R: Read + Send + 'static>(mut stream: R) -> mpsc::Receiver<(Vec<u8>, bool)> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut kept = Vec::new();
        let mut truncated = false;
        let mut buffer = [0u8; 8192];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let room = OUTPUT_LIMIT_BYTES.saturating_sub(kept.len());
                    kept.extend_from_slice(&buffer[..count.min(room)]);
                    truncated |= count > room;
                }
            }
        }
        let _ = sender.send((kept, truncated));
    });
    receiver
}

fn collect_output(receiver: mpsc::Receiver<(Vec<u8>, bool)>) -> (Vec<u8>, bool) {
    receiver.recv_timeout(Duration::from_millis(500)).unwrap_or_default()
}

#[cfg(unix)]
fn kill_process_group(child: &mut std::process::Child) {
    // SAFETY: plain kill(2) on the child's own process group, created via process_group(0).
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    let _ = child.kill();
}

#[cfg(not(unix))]
fn kill_process_group(child: &mut std::process::Child) {
    let _ = child.kill();
}

fn execute(mut command: Command, isolation: Isolation, timeout: Duration) -> Result<RunOutcome, AppError> {
    let mut child = command
        .spawn()
        .map_err(|error| AppError::new("storage", format!("could not start Python: {error}")))?;
    let stdout_reader = read_capped(child.stdout.take().expect("stdout is piped"));
    let stderr_reader = read_capped(child.stderr.take().expect("stderr is piped"));

    let deadline = Instant::now() + timeout;
    let (status, timed_out) = loop {
        match child.try_wait()? {
            Some(status) => break (Some(status), false),
            None if Instant::now() >= deadline => {
                kill_process_group(&mut child);
                break (child.wait().ok(), true);
            }
            None => thread::sleep(Duration::from_millis(10)),
        }
    };

    let (stdout, stdout_truncated) = collect_output(stdout_reader);
    let (stderr, stderr_truncated) = collect_output(stderr_reader);
    Ok(RunOutcome {
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
        exit_code: status.and_then(|status| status.code()),
        timed_out,
        output_truncated: stdout_truncated || stderr_truncated,
        isolation,
    })
}

fn choose_isolation(allow_unsandboxed: bool) -> Result<Isolation, AppError> {
    if bubblewrap_is_usable() {
        Ok(Isolation::Bubblewrap)
    } else if allow_unsandboxed {
        Ok(Isolation::None)
    } else {
        Err(AppError::new(
            "containment-unavailable",
            "No usable sandbox. On Linux Mint: sudo apt install bubblewrap. \
             Unsandboxed runs use the full access of your user account and need your explicit approval.",
        ))
    }
}

fn require_python() -> Result<PathBuf, AppError> {
    find_python().ok_or_else(|| AppError::new("no-python", "no Python 3 interpreter was found on PATH"))
}

fn is_valid_nonce(nonce: &str) -> bool {
    (8..=64).contains(&nonce.len()) && nonce.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

async fn on_blocking_thread<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| AppError::new("storage", error.to_string()))?
}

#[tauri::command]
pub fn sandbox_status() -> SandboxStatus {
    SandboxStatus {
        python_path: find_python().map(|path| path.to_string_lossy().into_owned()),
        bubblewrap_usable: bubblewrap_is_usable(),
    }
}

fn run_python_in(
    directory: &Path,
    file_name: &str,
    allow_unsandboxed: bool,
    timeout: Duration,
) -> Result<RunOutcome, AppError> {
    if !directory.join(file_name).is_file() {
        return Err(AppError::new("file-not-found", format!("{file_name} has not been saved yet")));
    }
    let python = require_python()?;
    let isolation = choose_isolation(allow_unsandboxed)?;
    let command = build_command(isolation, &python, directory, &[file_name], &[])?;
    execute(command, isolation, timeout)
}

/// Copies the student's files beside the objective tests in a throwaway directory and runs them.
/// The tests report results as a nonce-tagged JSON line on stdout.
fn run_checks_in(
    project: &Path,
    test_source: &str,
    nonce: &str,
    allow_unsandboxed: bool,
    timeout: Duration,
) -> Result<RunOutcome, AppError> {
    let python = require_python()?;
    let isolation = choose_isolation(allow_unsandboxed)?;

    let unique_suffix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    let scratch = std::env::temp_dir().join(format!("pydisc-checks-{}-{unique_suffix}", std::process::id()));
    fs::create_dir_all(&scratch)?;

    let result = (|| {
        if let Ok(entries) = fs::read_dir(project) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().into_owned();
                if validate_file_name(&name).is_ok() {
                    fs::copy(entry.path(), scratch.join(&name))?;
                }
            }
        }
        fs::write(scratch.join(RESERVED_CHECKS_FILE_NAME), test_source.as_bytes())?;
        let command = build_command(
            isolation,
            &python,
            &scratch,
            &[RESERVED_CHECKS_FILE_NAME],
            &[("PYDISC_NONCE", nonce)],
        )?;
        execute(command, isolation, timeout)
    })();
    let _ = fs::remove_dir_all(&scratch);
    result
}

#[tauri::command]
pub async fn run_python(
    app: AppHandle,
    project_id: String,
    file_name: String,
    allow_unsandboxed: bool,
) -> Result<RunOutcome, AppError> {
    validate_file_name(&file_name)?;
    let directory = project_directory(&app, &project_id)?;
    on_blocking_thread(move || run_python_in(&directory, &file_name, allow_unsandboxed, WALL_TIMEOUT)).await
}

#[tauri::command]
pub async fn run_checks(
    app: AppHandle,
    project_id: String,
    test_source: String,
    nonce: String,
    allow_unsandboxed: bool,
) -> Result<RunOutcome, AppError> {
    if !is_valid_nonce(&nonce) {
        return Err(AppError::new("invalid-run-request", "invalid nonce"));
    }
    if test_source.len() > MAX_FILE_BYTES {
        return Err(AppError::new("invalid-run-request", "test source is too large"));
    }
    let project = project_directory(&app, &project_id)?;
    on_blocking_thread(move || run_checks_in(&project, &test_source, &nonce, allow_unsandboxed, WALL_TIMEOUT)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sandbox_arguments_cut_network_and_mount_system_read_only() {
        let arguments: Vec<String> = base_sandbox_arguments()
            .iter()
            .map(|argument| argument.to_string_lossy().into_owned())
            .collect();
        assert!(arguments.contains(&"--unshare-all".to_string()));
        assert!(arguments.contains(&"--die-with-parent".to_string()));
        let ro_bind = arguments.iter().position(|argument| argument == "--ro-bind").unwrap();
        assert_eq!(arguments[ro_bind + 1], "/usr");
    }

    #[test]
    fn nonce_validation_rejects_short_and_unsafe_values() {
        assert!(is_valid_nonce("0123abcd-ef01"));
        for nonce in ["short", "has space1234", "semi;colon1234", &"a".repeat(65)] {
            assert!(!is_valid_nonce(nonce), "{nonce} should be rejected");
        }
    }

    fn shell(script: &str) -> Command {
        let mut command = Command::new("sh");
        command.args(["-c", script]).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        std::os::unix::process::CommandExt::process_group(&mut command, 0);
        command
    }

    #[test]
    fn execute_captures_output_and_exit_code() {
        let outcome = execute(shell("echo out; echo err >&2; exit 3"), Isolation::None, Duration::from_secs(5)).unwrap();
        assert_eq!(outcome.stdout.trim(), "out");
        assert_eq!(outcome.stderr.trim(), "err");
        assert_eq!(outcome.exit_code, Some(3));
        assert!(!outcome.timed_out);
    }

    #[test]
    fn execute_kills_process_that_exceeds_the_wall_timeout() {
        let started = Instant::now();
        let outcome = execute(shell("sleep 5"), Isolation::None, Duration::from_millis(200)).unwrap();
        assert!(outcome.timed_out);
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[test]
    fn execute_caps_runaway_output() {
        let outcome = execute(shell("yes | head -c 500000"), Isolation::None, Duration::from_secs(5)).unwrap();
        assert!(outcome.output_truncated);
        assert_eq!(outcome.stdout.len(), OUTPUT_LIMIT_BYTES);
    }

    fn temporary_project(name: &str, main_source: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!("pydisc-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("main.py"), main_source).unwrap();
        directory
    }

    fn python_available() -> bool {
        find_python().is_some()
    }

    #[test]
    fn run_python_runs_a_saved_file_and_reports_the_isolation_used() {
        if !python_available() {
            return;
        }
        let project = temporary_project("hello", "print('hello from student')\n");
        let outcome = run_python_in(&project, "main.py", true, Duration::from_secs(10)).unwrap();
        assert_eq!(outcome.stdout.trim(), "hello from student");
        assert_eq!(outcome.exit_code, Some(0));
        let expected = if bubblewrap_is_usable() { Isolation::Bubblewrap } else { Isolation::None };
        assert_eq!(outcome.isolation, expected);
        fs::remove_dir_all(project).unwrap();
    }

    #[test]
    fn run_python_refuses_to_run_unsandboxed_without_consent() {
        if !python_available() || bubblewrap_is_usable() {
            return;
        }
        let project = temporary_project("consent", "print('x')\n");
        let error = run_python_in(&project, "main.py", false, Duration::from_secs(5)).unwrap_err();
        assert_eq!(error.code, "containment-unavailable");
        fs::remove_dir_all(project).unwrap();
    }

    #[test]
    fn run_python_reports_a_missing_file_and_python_errors() {
        if !python_available() {
            return;
        }
        let project = temporary_project("errors", "raise ValueError('boom')\n");
        assert_eq!(run_python_in(&project, "absent.py", true, Duration::from_secs(5)).unwrap_err().code, "file-not-found");
        let outcome = run_python_in(&project, "main.py", true, Duration::from_secs(10)).unwrap();
        assert_ne!(outcome.exit_code, Some(0));
        assert!(outcome.stderr.contains("ValueError: boom"));
        fs::remove_dir_all(project).unwrap();
    }

    #[test]
    fn run_python_stops_an_infinite_loop_at_the_wall_timeout() {
        if !python_available() {
            return;
        }
        let project = temporary_project("loop", "while True:\n    pass\n");
        let started = Instant::now();
        let outcome = run_python_in(&project, "main.py", true, Duration::from_millis(800)).unwrap();
        assert!(outcome.timed_out);
        assert!(started.elapsed() < Duration::from_secs(5));
        fs::remove_dir_all(project).unwrap();
    }

    #[test]
    fn sandbox_blocks_network_and_hides_the_rest_of_the_filesystem() {
        if !python_available() || !bubblewrap_is_usable() {
            return;
        }
        let source = "import socket, os\n\
            try:\n    socket.create_connection(('1.1.1.1', 53), timeout=2)\n    print('NETWORK OPEN')\n\
            except OSError:\n    print('network blocked')\n\
            print('home visible' if os.path.exists('/root') or os.path.exists('/home') else 'home hidden')\n\
            open('written.txt', 'w').write('kept')\n";
        let project = temporary_project("sandbox", source);
        let outcome = run_python_in(&project, "main.py", false, Duration::from_secs(10)).unwrap();
        assert_eq!(outcome.isolation, Isolation::Bubblewrap);
        assert!(outcome.stdout.contains("network blocked"), "stdout: {} stderr: {}", outcome.stdout, outcome.stderr);
        assert!(outcome.stdout.contains("home hidden"), "stdout: {}", outcome.stdout);
        assert_eq!(fs::read_to_string(project.join("written.txt")).unwrap(), "kept");
        fs::remove_dir_all(project).unwrap();
    }

    #[test]
    fn run_checks_reports_through_the_nonce_line_and_cleans_up() {
        if !python_available() {
            return;
        }
        let project = temporary_project("checks", "def double(x):\n    return x * 2\n");
        let tests = "import os, json, sys\n\
            nonce = os.environ['PYDISC_NONCE']\n\
            import main\n\
            ok = main.double(4) == 8\n\
            sys.stdout.write('\\n@@PYDISC:' + nonce + '@@' + json.dumps({'test_double': {'status': 'pass' if ok else 'fail', 'message': ''}}) + '\\n')\n";
        let outcome = run_checks_in(&project, tests, "nonce-1234", true, Duration::from_secs(10)).unwrap();
        assert!(outcome.stdout.contains("@@PYDISC:nonce-1234@@"), "stdout: {} stderr: {}", outcome.stdout, outcome.stderr);
        assert!(outcome.stdout.contains("\"status\": \"pass\""));
        assert!(!project.join(RESERVED_CHECKS_FILE_NAME).exists(), "checks must run in a scratch copy");
        fs::remove_dir_all(project).unwrap();
    }
}
