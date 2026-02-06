use std::collections::HashMap;
use std::path::Path;
use tokio::process::Command;
/// Get the current git branch name for a given workspace path.
/// Returns None if the path is not inside a git repository.
#[tauri::command]
pub async fn get_git_branch(path: String) -> Result<Option<String>, String> {
    let git_head = Path::new(&path).join(".git/HEAD");

    // Use tokio::fs for async file existence check
    if tokio::fs::metadata(&git_head).await.is_err() {
        return Ok(None);
    }

    let content = tokio::fs::read_to_string(&git_head)
        .await
        .map_err(|e| format!("Failed to read .git/HEAD: {}", e))?;

    let trimmed = content.trim();

    if let Some(ref_path) = trimmed.strip_prefix("ref: refs/heads/") {
        // Normal branch reference
        Ok(Some(ref_path.to_string()))
    } else if trimmed.len() >= 7 {
        // Detached HEAD - return short SHA
        Ok(Some(trimmed[..7].to_string()))
    } else {
        Ok(None)
    }
}

/// Get git status for all files in the workspace.
/// Returns a map of relative_path -> status_code.
/// Status codes: "M" (modified), "A" (added), "D" (deleted), "?" (untracked),
/// "R" (renamed), "C" (copied), "U" (unmerged), "!" (ignored)
#[tauri::command]
pub async fn get_git_status(path: String) -> Result<HashMap<String, String>, String> {
    let workspace = Path::new(&path);

    // Use tokio::fs for async directory existence check
    if tokio::fs::metadata(workspace.join(".git")).await.is_err() {
        return Ok(HashMap::new());
    }

    let output = Command::new("git")
        .args(["status", "--porcelain", "-uall"])
        .current_dir(workspace)
        .output()
        .await
        .map_err(|e| format!("Failed to run git status: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git status failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut statuses: HashMap<String, String> = HashMap::new();

    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }

        let xy = &line[..2];
        let file_path = line[3..].trim();

        // Handle renames: "R  old -> new"
        let actual_path = if let Some(arrow_pos) = file_path.find(" -> ") {
            &file_path[arrow_pos + 4..]
        } else {
            file_path
        };

        // Determine the display status from the XY code
        let status = match xy.trim() {
            "M" | " M" | "MM" => "M",    // Modified
            "A" | "AM" => "A",            // Added
            "D" | " D" => "D",            // Deleted
            "R" | "RM" => "R",            // Renamed
            "C" => "C",                   // Copied
            "??" => "?",                  // Untracked
            "!!" => "!",                  // Ignored
            "UU" | "AA" | "DD" => "U",   // Unmerged/conflict
            _ => "M",                     // Default to modified
        };

        // Store with the full path relative to workspace
        statuses.insert(actual_path.to_string(), status.to_string());

        // Also mark parent directories so the tree can show status bubbling
        let mut parent = Path::new(actual_path).parent();
        while let Some(p) = parent {
            let parent_str = p.to_string_lossy().to_string();
            if parent_str.is_empty() {
                break;
            }
            // Only set parent status if not already set (don't override more specific status)
            statuses.entry(parent_str).or_insert_with(|| status.to_string());
            parent = p.parent();
        }
    }

    Ok(statuses)
}
