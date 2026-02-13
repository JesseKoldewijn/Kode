use kode_lib::commands::editor::{edit_buffer, get_highlights, open_buffer};
/// Deadlock Reproduction Tests
///
/// These tests replicate the exact frontend file-opening sequence to reproduce
/// the hanging `open_buffer` issue. They combine filesystem commands (read_file)
/// with editor commands (open_buffer, get_highlights) in realistic timing patterns.
use kode_lib::commands::filesystem::read_file;
use kode_lib::editor::buffer::MANAGER;
use kode_lib::editor::editing::{EditOperation, TextRange};
use std::io::Write;
use std::time::Duration;
use tempfile::NamedTempFile;
use tokio::time::timeout;

/// Helper to create a JavaScript temp file
fn create_temp_js_file(content: &str) -> NamedTempFile {
    let mut file = tempfile::Builder::new().suffix(".js").tempfile().unwrap();
    file.write_all(content.as_bytes()).unwrap();
    file.flush().unwrap();
    file
}

/// Helper to cleanup buffer
async fn cleanup_buffer(buffer_id: &str) {
    let mut manager = MANAGER.write().await;
    manager.close(buffer_id);
}

/// Test 1: Exact frontend sequence - read_file then open_buffer
///
/// This replicates what workspace.ts does:
/// 1. await fs.readFile(path)  [workspace.ts:484]
/// 2. editorEngine.openBuffer(path).catch()  [workspace.ts:497]
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_read_file_then_open_buffer() {
    let temp_file = create_temp_js_file("const x = 42;");
    let path = temp_file.path().to_str().unwrap().to_string();

    // Step 1: read_file (what frontend does via fs.readFile)
    let content_result = read_file(path.clone()).await;
    assert!(content_result.is_ok(), "read_file should succeed");
    let content = content_result.unwrap();
    assert_eq!(content, "const x = 42;");

    // Step 2: open_buffer immediately after (fire-and-forget in real app)
    let result = timeout(Duration::from_secs(2), open_buffer(path.clone())).await;

    assert!(
        result.is_ok(),
        "open_buffer HUNG - DEADLOCK! Should complete within 2 seconds"
    );
    let buffer_info = result.unwrap().unwrap();
    assert_eq!(buffer_info.id, path);
    assert_eq!(buffer_info.char_count, 13);

    cleanup_buffer(&path).await;
}

/// Test 2: Open buffer while another buffer is being parsed
///
/// Suspected deadlock scenario:
/// - File A is opened, get_highlights spawns parse task (holds write lock)
/// - File B's open_buffer tries to acquire write lock → hangs waiting for parse
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_open_buffer_while_parsing() {
    // Create two JS files
    let file_a = create_temp_js_file("function foo() { return 'hello'; }");
    let file_b = create_temp_js_file("function bar() { return 'world'; }");
    let path_a = file_a.path().to_str().unwrap().to_string();
    let path_b = file_b.path().to_str().unwrap().to_string();

    // Open file A
    let buffer_a = open_buffer(path_a.clone()).await.unwrap();

    // Request highlights for file A (spawns background parse task)
    let highlights_task = tokio::spawn({
        let path = path_a.clone();
        async move { get_highlights(path, 0, 10).await }
    });

    // Immediately try to open file B (should not be blocked by file A's parsing)
    tokio::time::sleep(Duration::from_millis(5)).await;
    let open_b_task = tokio::spawn({
        let path = path_b.clone();
        async move { open_buffer(path).await }
    });

    // Both operations should complete within 2 seconds
    let result = timeout(Duration::from_secs(2), async {
        let highlights_result = highlights_task.await.unwrap();
        let open_b_result = open_b_task.await.unwrap();
        (highlights_result, open_b_result)
    })
    .await;

    assert!(
        result.is_ok(),
        "File B's open_buffer HUNG while file A was parsing - DEADLOCK!"
    );
    let (highlights_a, buffer_b) = result.unwrap();
    assert!(highlights_a.is_ok());
    assert!(buffer_b.is_ok());
    assert_eq!(buffer_b.unwrap().id, path_b);

    cleanup_buffer(&path_a).await;
    cleanup_buffer(&path_b).await;
}

/// Test 3: Rapid multi-file open with highlights (realistic rapid clicking)
///
/// Simulates user clicking through 5 files quickly:
/// - Each file: read_file → open_buffer → get_highlights (after 16ms debounce)
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_rapid_multi_file_open_with_highlights() {
    let files: Vec<_> = (0..5)
        .map(|i| create_temp_js_file(&format!("const file{} = {};", i, i)))
        .collect();

    let paths: Vec<String> = files
        .iter()
        .map(|f| f.path().to_str().unwrap().to_string())
        .collect();

    // Open all files in rapid succession
    let mut tasks = vec![];
    for path in &paths {
        let path_clone = path.clone();
        tasks.push(tokio::spawn(async move {
            // Frontend sequence: read_file → open_buffer → get_highlights
            let _content = read_file(path_clone.clone()).await.unwrap();
            let buffer_info = open_buffer(path_clone.clone()).await.unwrap();

            // Simulate 16ms debounce before highlights request
            tokio::time::sleep(Duration::from_millis(16)).await;
            let _highlights = get_highlights(path_clone.clone(), 0, 50).await;

            buffer_info
        }));
    }

    // All operations should complete within 5 seconds
    let result = timeout(Duration::from_secs(5), async {
        let mut results = vec![];
        for task in tasks {
            results.push(task.await.unwrap());
        }
        results
    })
    .await;

    assert!(result.is_ok(), "Rapid multi-file open HUNG - DEADLOCK!");
    let results = result.unwrap();
    assert_eq!(results.len(), 5);

    for path in &paths {
        cleanup_buffer(path).await;
    }
}

/// Test 4: Open buffer while editing another buffer
///
/// Simulates typing in file A while opening file B:
/// - File A: edit_buffer (holds write lock during tree-sitter parse)
/// - File B: open_buffer concurrently (should not be blocked)
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_open_buffer_while_editing() {
    let file_a = create_temp_js_file("hello");
    let file_b = create_temp_js_file("world");
    let path_a = file_a.path().to_str().unwrap().to_string();
    let path_b = file_b.path().to_str().unwrap().to_string();

    // Open file A
    open_buffer(path_a.clone()).await.unwrap();

    // Start editing file A (holds write lock during parse)
    let edit_task = tokio::spawn({
        let path = path_a.clone();
        async move {
            let edit = EditOperation {
                range: TextRange {
                    start_line: 0,
                    start_col: 5,
                    end_line: 0,
                    end_col: 5,
                },
                new_text: " world".to_string(),
            };
            edit_buffer(path, edit).await
        }
    });

    // Concurrently try to open file B
    tokio::time::sleep(Duration::from_millis(2)).await;
    let open_task = tokio::spawn({
        let path = path_b.clone();
        async move { open_buffer(path).await }
    });

    // Both should complete within 2 seconds
    let result = timeout(Duration::from_secs(2), async {
        let edit_result = edit_task.await.unwrap();
        let open_result = open_task.await.unwrap();
        (edit_result, open_result)
    })
    .await;

    assert!(
        result.is_ok(),
        "File B's open_buffer HUNG while file A was being edited - DEADLOCK!"
    );
    let (edit_result, open_result) = result.unwrap();
    assert!(edit_result.is_ok());
    assert!(open_result.is_ok());

    cleanup_buffer(&path_a).await;
    cleanup_buffer(&path_b).await;
}

/// Test 5: Concurrent highlights and open
///
/// Multiple files with pending parse + new file open:
/// - Open 3 files without highlights (tree: None)
/// - Fire get_highlights for all 3 (spawns parse tasks)
/// - Immediately open a 4th file
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_concurrent_highlights_and_open() {
    let files: Vec<_> = (0..4)
        .map(|i| create_temp_js_file(&format!("const x{} = {};", i, i)))
        .collect();

    let paths: Vec<String> = files
        .iter()
        .map(|f| f.path().to_str().unwrap().to_string())
        .collect();

    // Open first 3 files
    for i in 0..3 {
        open_buffer(paths[i].clone()).await.unwrap();
    }

    // Fire highlights for all 3 (spawns parse tasks)
    let mut highlight_tasks = vec![];
    for i in 0..3 {
        let path = paths[i].clone();
        highlight_tasks.push(tokio::spawn(
            async move { get_highlights(path, 0, 50).await },
        ));
    }

    // Immediately try to open 4th file
    tokio::time::sleep(Duration::from_millis(5)).await;
    let open_task = tokio::spawn({
        let path = paths[3].clone();
        async move { open_buffer(path).await }
    });

    // All should complete within 3 seconds
    let result = timeout(Duration::from_secs(3), async {
        for task in highlight_tasks {
            task.await.unwrap().ok();
        }
        open_task.await.unwrap()
    })
    .await;

    assert!(
        result.is_ok(),
        "4th file's open_buffer HUNG while 3 files were parsing - DEADLOCK!"
    );
    assert!(result.unwrap().is_ok());

    for path in &paths {
        cleanup_buffer(path).await;
    }
}

/// Test 6: Full frontend lifecycle sequence
///
/// Complete sequence including selections:
/// read_file → open_buffer → get_highlights (empty) → get_highlights (retry) → set_selections
/// Repeated for 3 files rapidly
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_full_frontend_sequence() {
    let files: Vec<_> = (0..3)
        .map(|i| create_temp_js_file(&format!("const data{} = {};", i, i * 10)))
        .collect();

    let paths: Vec<String> = files
        .iter()
        .map(|f| f.path().to_str().unwrap().to_string())
        .collect();

    let mut tasks = vec![];
    for path in &paths {
        let path_clone = path.clone();
        tasks.push(tokio::spawn(async move {
            // Step 1: read_file
            let _content = read_file(path_clone.clone()).await.unwrap();

            // Step 2: open_buffer
            let _buffer = open_buffer(path_clone.clone()).await.unwrap();

            // Step 3: get_highlights (first call - returns empty, spawns parse)
            let highlights1 = get_highlights(path_clone.clone(), 0, 50).await.unwrap();

            // Step 4: wait for parse, then retry highlights
            tokio::time::sleep(Duration::from_millis(50)).await;
            let highlights2 = get_highlights(path_clone.clone(), 0, 50).await.unwrap();

            (highlights1, highlights2)
        }));
    }

    // All operations should complete within 5 seconds
    let result = timeout(Duration::from_secs(5), async {
        let mut results = vec![];
        for task in tasks {
            results.push(task.await.unwrap());
        }
        results
    })
    .await;

    assert!(result.is_ok(), "Full frontend sequence HUNG - DEADLOCK!");
    let results = result.unwrap();

    // First highlights should be empty (not parsed yet), second should have data
    for (highlights1, highlights2) in results {
        assert_eq!(
            highlights1.lines.len(),
            0,
            "First highlights should be empty"
        );
        assert!(
            highlights2.lines.len() > 0 || highlights2.total_lines > 0,
            "Second highlights should have data"
        );
    }

    for path in &paths {
        cleanup_buffer(path).await;
    }
}

/// Test 7: Stress test - 10 files opened as fast as possible
///
/// Maximum stress test to expose any deadlock under heavy concurrent load
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_stress_ten_files_concurrent() {
    let files: Vec<_> = (0..10)
        .map(|i| create_temp_js_file(&format!("function func{}() {{ return {}; }}", i, i)))
        .collect();

    let paths: Vec<String> = files
        .iter()
        .map(|f| f.path().to_str().unwrap().to_string())
        .collect();

    // Fire all operations concurrently (no delays)
    let mut tasks = vec![];
    for path in &paths {
        let path_clone = path.clone();
        tasks.push(tokio::spawn(async move { open_buffer(path_clone).await }));
    }

    // All 10 opens should complete within 5 seconds
    let result = timeout(Duration::from_secs(5), async {
        let mut results = vec![];
        for task in tasks {
            results.push(task.await.unwrap());
        }
        results
    })
    .await;

    assert!(result.is_ok(), "Stress test with 10 files HUNG - DEADLOCK!");
    let results = result.unwrap();
    assert_eq!(results.len(), 10);
    assert!(results.iter().all(|r| r.is_ok()));

    for path in &paths {
        cleanup_buffer(path).await;
    }
}
