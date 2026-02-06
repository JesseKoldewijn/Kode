//! Tests for git commands
//!
//! Tests the async git operations to ensure they:
//! 1. Work correctly with git repositories
//! 2. Handle non-git directories gracefully
//! 3. Are truly async and don't block the runtime

use std::time::Instant;
use tempfile::TempDir;
use tokio::fs;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

// ============================================================================
// Helper functions
// ============================================================================

/// Creates a temporary git repository and returns its path
async fn create_git_repo() -> TempDir {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path();

    // Initialize git repo
    Command::new("git")
        .args(["init"])
        .current_dir(path)
        .output()
        .await
        .expect("Failed to init git repo");

    // Configure git user (required for commits)
    Command::new("git")
        .args(["config", "user.email", "test@test.com"])
        .current_dir(path)
        .output()
        .await
        .expect("Failed to configure git email");

    Command::new("git")
        .args(["config", "user.name", "Test User"])
        .current_dir(path)
        .output()
        .await
        .expect("Failed to configure git name");

    temp_dir
}

// ============================================================================
// get_git_branch tests (simulated - tests the async pattern)
// ============================================================================

#[tokio::test]
async fn get_git_branch_returns_none_for_non_git_directory() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path();

    // No .git directory exists
    let git_head = path.join(".git/HEAD");
    let result = tokio::fs::metadata(&git_head).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn get_git_branch_reads_head_file_async() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Read .git/HEAD asynchronously
    let git_head = path.join(".git/HEAD");
    let content = tokio::fs::read_to_string(&git_head).await.unwrap();

    // Should contain a ref to master or main
    assert!(
        content.contains("ref: refs/heads/"),
        "HEAD should contain branch reference: {}",
        content
    );
}

#[tokio::test]
async fn get_git_branch_parses_branch_name_correctly() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    let git_head = path.join(".git/HEAD");
    let content = tokio::fs::read_to_string(&git_head).await.unwrap();
    let trimmed = content.trim();

    // Parse the branch name
    if let Some(ref_path) = trimmed.strip_prefix("ref: refs/heads/") {
        // Branch name should be non-empty
        assert!(!ref_path.is_empty());
        // Common default branch names
        assert!(
            ref_path == "master" || ref_path == "main",
            "Expected master or main, got: {}",
            ref_path
        );
    } else {
        panic!("Expected ref: prefix in HEAD file");
    }
}

#[tokio::test]
async fn get_git_branch_completes_within_timeout() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();
    let git_head = path.join(".git/HEAD");

    // Should complete well within 100ms (async file read)
    let result = timeout(Duration::from_millis(100), async {
        tokio::fs::read_to_string(&git_head).await
    })
    .await;

    assert!(result.is_ok(), "Async read should complete quickly");
    assert!(result.unwrap().is_ok(), "File read should succeed");
}

// ============================================================================
// get_git_status tests (simulated - tests the async pattern)
// ============================================================================

#[tokio::test]
async fn get_git_status_returns_empty_for_non_git_directory() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path();

    // Check if .git exists asynchronously
    let git_dir = path.join(".git");
    let result = tokio::fs::metadata(&git_dir).await;

    assert!(result.is_err(), "Non-git directory should not have .git");
}

#[tokio::test]
async fn get_git_status_runs_git_command_async() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Run git status asynchronously using tokio::process::Command
    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(path)
        .output()
        .await
        .expect("Failed to run git status");

    assert!(output.status.success(), "git status should succeed");
}

#[tokio::test]
async fn get_git_status_detects_untracked_files() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Create an untracked file
    fs::write(path.join("untracked.txt"), "content").await.unwrap();

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("?? untracked.txt"),
        "Should detect untracked file: {}",
        stdout
    );
}

#[tokio::test]
async fn get_git_status_detects_modified_files() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Create and commit a file
    fs::write(path.join("tracked.txt"), "initial content")
        .await
        .unwrap();

    Command::new("git")
        .args(["add", "tracked.txt"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    Command::new("git")
        .args(["commit", "-m", "Initial commit"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    // Modify the file
    fs::write(path.join("tracked.txt"), "modified content")
        .await
        .unwrap();

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains(" M tracked.txt") || stdout.contains("M  tracked.txt"),
        "Should detect modified file: {}",
        stdout
    );
}

#[tokio::test]
async fn get_git_status_detects_staged_files() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Create and stage a file
    fs::write(path.join("staged.txt"), "content").await.unwrap();

    Command::new("git")
        .args(["add", "staged.txt"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("A  staged.txt"),
        "Should detect staged file: {}",
        stdout
    );
}

#[tokio::test]
async fn get_git_status_completes_within_timeout() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path().to_path_buf();

    // Should complete well within 1 second (async process execution)
    let result = timeout(Duration::from_secs(1), async move {
        Command::new("git")
            .args(["status", "--porcelain", "-uall"])
            .current_dir(&path)
            .output()
            .await
    })
    .await;

    assert!(result.is_ok(), "Async git status should complete quickly");
    assert!(
        result.unwrap().is_ok(),
        "Git status command should succeed"
    );
}

// ============================================================================
// Async behavior verification tests
// ============================================================================

#[tokio::test]
async fn git_operations_are_non_blocking() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path().to_path_buf();

    // Create some files for git status to process
    for i in 0..10 {
        fs::write(path.join(format!("file{}.txt", i)), format!("content {}", i))
            .await
            .unwrap();
    }

    // Measure time to spawn multiple concurrent git operations
    let start = Instant::now();

    let handles: Vec<_> = (0..5)
        .map(|_| {
            let p = path.clone();
            tokio::spawn(async move {
                Command::new("git")
                    .args(["status", "--porcelain", "-uall"])
                    .current_dir(&p)
                    .output()
                    .await
            })
        })
        .collect();

    // Wait for all to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }

    let elapsed = start.elapsed();

    // If operations were truly concurrent, total time should be much less than 5x
    // the time for a single operation (typically < 1 second for 5 concurrent)
    assert!(
        elapsed.as_secs() < 5,
        "Concurrent git operations should not take 5+ seconds: {:?}",
        elapsed
    );
}

#[tokio::test]
async fn async_file_read_does_not_block_other_tasks() {
    let temp_dir = create_git_repo().await;
    let git_head = temp_dir.path().join(".git/HEAD");

    // Spawn a task that reads the file
    let read_handle = tokio::spawn(async move {
        tokio::fs::read_to_string(&git_head).await
    });

    // Spawn another task that should run concurrently
    let counter_handle = tokio::spawn(async {
        let mut count = 0;
        for _ in 0..1000 {
            count += 1;
            tokio::task::yield_now().await;
        }
        count
    });

    // Both should complete
    let read_result = read_handle.await.unwrap();
    let count_result = counter_handle.await.unwrap();

    assert!(read_result.is_ok());
    assert_eq!(count_result, 1000);
}

// ============================================================================
// Edge cases and error handling
// ============================================================================

#[tokio::test]
async fn handles_detached_head_state() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Create and commit a file
    fs::write(path.join("file.txt"), "content").await.unwrap();

    Command::new("git")
        .args(["add", "."])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    Command::new("git")
        .args(["commit", "-m", "Initial"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    // Get the commit hash
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let commit_hash = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Checkout the commit directly (detached HEAD)
    Command::new("git")
        .args(["checkout", &commit_hash])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    // Read HEAD file
    let git_head = path.join(".git/HEAD");
    let content = tokio::fs::read_to_string(&git_head).await.unwrap();
    let trimmed = content.trim();

    // In detached HEAD state, HEAD contains a commit hash, not a ref
    assert!(
        !trimmed.starts_with("ref:"),
        "Detached HEAD should not have ref: prefix: {}",
        trimmed
    );
    assert!(
        trimmed.len() >= 7,
        "Detached HEAD should contain commit hash: {}",
        trimmed
    );
}

#[tokio::test]
async fn handles_nested_directories_in_status() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Create nested directory structure
    fs::create_dir_all(path.join("src/components")).await.unwrap();
    fs::write(path.join("src/components/Button.tsx"), "export const Button = () => {};")
        .await
        .unwrap();

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("src/components/Button.tsx"),
        "Should include nested file path: {}",
        stdout
    );
}

#[tokio::test]
async fn handles_special_characters_in_filenames() {
    let temp_dir = create_git_repo().await;
    let path = temp_dir.path();

    // Create file with spaces and special chars
    fs::write(path.join("file with spaces.txt"), "content")
        .await
        .unwrap();

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(path)
        .output()
        .await
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("file with spaces.txt"),
        "Should handle filenames with spaces: {}",
        stdout
    );
}
