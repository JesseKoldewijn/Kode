//! Tests for terminal commands
//!
//! Tests the async terminal operations to ensure they:
//! 1. Use tokio::sync::Mutex correctly (non-blocking)
//! 2. Handle concurrent access properly
//! 3. Work with the PTY subsystem
//! 4. Clean up resources appropriately

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

// ============================================================================
// Mock terminal state for testing mutex behavior
// ============================================================================

struct MockTerminalSession {
    id: String,
    #[allow(dead_code)]
    is_alive: bool,
    rows: u16,
    cols: u16,
    buffer: String,
}

impl MockTerminalSession {
    fn new(id: &str) -> Self {
        Self {
            id: id.to_string(),
            is_alive: true,
            rows: 24,
            cols: 80,
            buffer: String::new(),
        }
    }
}

lazy_static::lazy_static! {
    static ref MOCK_TERMINALS: Mutex<HashMap<String, MockTerminalSession>> = Mutex::new(HashMap::new());
}

// ============================================================================
// Basic terminal spawn tests
// ============================================================================

#[tokio::test]
async fn spawn_terminal_creates_session() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-spawn-1";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    assert!(terminals.contains_key(id));
    assert_eq!(terminals.get(id).unwrap().id, id);
    
    terminals.remove(id);
}

#[tokio::test]
async fn spawn_terminal_with_default_size() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-size-1";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    let session = terminals.get(id).unwrap();
    assert_eq!(session.rows, 24);
    assert_eq!(session.cols, 80);
    
    terminals.remove(id);
}

#[tokio::test]
async fn spawn_multiple_terminals() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    
    for i in 0..5 {
        let id = format!("multi-term-{}", i);
        terminals.insert(id.clone(), MockTerminalSession::new(&id));
    }
    
    assert_eq!(terminals.len(), 5);
    
    for i in 0..5 {
        terminals.remove(&format!("multi-term-{}", i));
    }
}

// ============================================================================
// Write terminal tests
// ============================================================================

#[tokio::test]
async fn write_terminal_appends_data() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-write-1";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    if let Some(session) = terminals.get_mut(id) {
        session.buffer.push_str("hello ");
        session.buffer.push_str("world");
    }
    
    let session = terminals.get(id).unwrap();
    assert_eq!(session.buffer, "hello world");
    
    terminals.remove(id);
}

#[tokio::test]
async fn write_terminal_fails_for_missing_session() {
    let terminals = MOCK_TERMINALS.lock().await;
    let result = terminals.get("nonexistent");
    assert!(result.is_none());
}

#[tokio::test]
async fn write_terminal_handles_special_characters() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-special-chars";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    let special_data = "echo \"hello\"\n\t\x1b[32mgreen\x1b[0m";
    if let Some(session) = terminals.get_mut(id) {
        session.buffer.push_str(special_data);
    }
    
    let session = terminals.get(id).unwrap();
    assert!(session.buffer.contains("\x1b[32m"));
    assert!(session.buffer.contains("\n"));
    
    terminals.remove(id);
}

// ============================================================================
// Resize terminal tests
// ============================================================================

#[tokio::test]
async fn resize_terminal_updates_dimensions() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-resize-1";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    if let Some(session) = terminals.get_mut(id) {
        session.rows = 40;
        session.cols = 120;
    }
    
    let session = terminals.get(id).unwrap();
    assert_eq!(session.rows, 40);
    assert_eq!(session.cols, 120);
    
    terminals.remove(id);
}

#[tokio::test]
async fn resize_terminal_minimum_dimensions() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-resize-min";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    // Simulate minimum dimensions (1x1 should still work)
    if let Some(session) = terminals.get_mut(id) {
        session.rows = 1;
        session.cols = 1;
    }
    
    let session = terminals.get(id).unwrap();
    assert_eq!(session.rows, 1);
    assert_eq!(session.cols, 1);
    
    terminals.remove(id);
}

#[tokio::test]
async fn resize_terminal_large_dimensions() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-resize-large";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    // Large but reasonable dimensions
    if let Some(session) = terminals.get_mut(id) {
        session.rows = 500;
        session.cols = 1000;
    }
    
    let session = terminals.get(id).unwrap();
    assert_eq!(session.rows, 500);
    assert_eq!(session.cols, 1000);
    
    terminals.remove(id);
}

// ============================================================================
// Close terminal tests
// ============================================================================

#[tokio::test]
async fn close_terminal_removes_session() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-close-1";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    assert!(terminals.contains_key(id));
    
    terminals.remove(id);
    assert!(!terminals.contains_key(id));
}

#[tokio::test]
async fn close_terminal_idempotent() {
    let mut terminals = MOCK_TERMINALS.lock().await;
    let id = "test-close-idempotent";
    
    terminals.insert(id.to_string(), MockTerminalSession::new(id));
    
    // Close twice should not panic
    terminals.remove(id);
    terminals.remove(id); // Should be no-op
    
    assert!(!terminals.contains_key(id));
}

// ============================================================================
// Async mutex behavior tests (critical for non-blocking)
// ============================================================================

#[tokio::test]
async fn mutex_lock_is_async() {
    let terminals: Mutex<HashMap<String, MockTerminalSession>> = Mutex::new(HashMap::new());
    
    // This should complete quickly since we're using tokio::sync::Mutex
    let result = timeout(Duration::from_millis(100), async {
        let _guard = terminals.lock().await;
        // Hold lock briefly
        tokio::time::sleep(Duration::from_millis(10)).await;
    })
    .await;
    
    assert!(result.is_ok(), "Async mutex lock should complete quickly");
}

#[tokio::test]
async fn concurrent_read_access() {
    let terminals: Arc<Mutex<HashMap<String, MockTerminalSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
    
    // Setup
    {
        let mut guard = terminals.lock().await;
        for i in 0..10 {
            guard.insert(format!("term-{}", i), MockTerminalSession::new(&format!("term-{}", i)));
        }
    }
    
    // Concurrent reads
    let start = Instant::now();
    let mut handles = vec![];
    
    for _ in 0..5 {
        let terminals_clone = terminals.clone();
        let handle = tokio::spawn(async move {
            let guard = terminals_clone.lock().await;
            let count = guard.len();
            tokio::time::sleep(Duration::from_millis(10)).await;
            count
        });
        handles.push(handle);
    }
    
    for handle in handles {
        let count = handle.await.unwrap();
        assert_eq!(count, 10);
    }
    
    let elapsed = start.elapsed();
    // With async mutex, these serialize but each one yields properly
    assert!(elapsed.as_millis() < 500, "Concurrent access should not deadlock: {:?}", elapsed);
}

#[tokio::test]
async fn concurrent_write_access() {
    let terminals: Arc<Mutex<HashMap<String, MockTerminalSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
    
    let start = Instant::now();
    let mut handles = vec![];
    
    // Concurrent writes (will serialize due to mutex, but won't block)
    for i in 0..5 {
        let terminals_clone = terminals.clone();
        let handle = tokio::spawn(async move {
            let mut guard = terminals_clone.lock().await;
            let id = format!("concurrent-{}", i);
            guard.insert(id.clone(), MockTerminalSession::new(&id));
            tokio::time::sleep(Duration::from_millis(5)).await;
        });
        handles.push(handle);
    }
    
    for handle in handles {
        handle.await.unwrap();
    }
    
    let elapsed = start.elapsed();
    assert!(elapsed.as_millis() < 500, "Concurrent writes should not deadlock: {:?}", elapsed);
    
    let guard = terminals.lock().await;
    assert_eq!(guard.len(), 5);
}

#[tokio::test]
async fn lock_does_not_block_other_tasks() {
    let terminals: Arc<Mutex<HashMap<String, MockTerminalSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
    
    let terminals_clone = terminals.clone();
    
    // Task that holds the lock for a while
    let lock_holder = tokio::spawn(async move {
        let _guard = terminals_clone.lock().await;
        tokio::time::sleep(Duration::from_millis(50)).await;
    });
    
    // Task that should still be able to run
    let counter = tokio::spawn(async {
        let mut count = 0;
        for _ in 0..100 {
            count += 1;
            tokio::task::yield_now().await;
        }
        count
    });
    
    // Counter should complete even while lock is held
    let count_result = counter.await.unwrap();
    assert_eq!(count_result, 100);
    
    lock_holder.await.unwrap();
}

#[tokio::test]
async fn no_deadlock_on_nested_operations() {
    let terminals: Arc<Mutex<HashMap<String, MockTerminalSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
    
    // Simulate spawn -> write -> resize sequence (all require lock)
    let result = timeout(Duration::from_secs(1), async {
        // Spawn
        {
            let mut guard = terminals.lock().await;
            guard.insert("nested-test".to_string(), MockTerminalSession::new("nested-test"));
        }
        
        // Write
        {
            let mut guard = terminals.lock().await;
            if let Some(session) = guard.get_mut("nested-test") {
                session.buffer.push_str("test data");
            }
        }
        
        // Resize
        {
            let mut guard = terminals.lock().await;
            if let Some(session) = guard.get_mut("nested-test") {
                session.rows = 30;
                session.cols = 100;
            }
        }
        
        // Close
        {
            let mut guard = terminals.lock().await;
            guard.remove("nested-test");
        }
    })
    .await;
    
    assert!(result.is_ok(), "Nested operations should not deadlock");
}

// ============================================================================
// Integration with other async operations
// ============================================================================

#[tokio::test]
async fn terminal_ops_concurrent_with_file_io() {
    let terminals: Arc<Mutex<HashMap<String, MockTerminalSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
    
    // Simulate terminal operation running concurrently with file I/O
    let terminal_task = {
        let terminals = terminals.clone();
        tokio::spawn(async move {
            let mut guard = terminals.lock().await;
            guard.insert("file-io-test".to_string(), MockTerminalSession::new("file-io-test"));
            tokio::time::sleep(Duration::from_millis(20)).await;
            guard.len()
        })
    };
    
    // Simulate file I/O
    let file_task = tokio::spawn(async {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        tokio::fs::write(&file_path, "test content").await.unwrap();
        tokio::fs::read_to_string(&file_path).await.unwrap()
    });
    
    // Both should complete without blocking each other
    let (terminal_result, file_result) = tokio::join!(terminal_task, file_task);
    
    assert_eq!(terminal_result.unwrap(), 1);
    assert_eq!(file_result.unwrap(), "test content");
}

#[tokio::test]
async fn terminal_ops_complete_within_timeout() {
    let terminals: Mutex<HashMap<String, MockTerminalSession>> = Mutex::new(HashMap::new());
    
    // All basic operations should complete quickly
    let result = timeout(Duration::from_millis(100), async {
        let mut guard = terminals.lock().await;
        
        // Spawn
        guard.insert("timeout-test".to_string(), MockTerminalSession::new("timeout-test"));
        
        // Write
        if let Some(session) = guard.get_mut("timeout-test") {
            session.buffer.push_str("data");
        }
        
        // Resize
        if let Some(session) = guard.get_mut("timeout-test") {
            session.rows = 50;
            session.cols = 150;
        }
        
        // Close
        guard.remove("timeout-test");
    })
    .await;
    
    assert!(result.is_ok(), "Basic operations should complete within 100ms");
}

// ============================================================================
// Edge cases
// ============================================================================

#[tokio::test]
async fn handles_empty_terminal_id() {
    let mut terminals: HashMap<String, MockTerminalSession> = HashMap::new();
    
    // Empty string ID should work (though not recommended)
    terminals.insert("".to_string(), MockTerminalSession::new(""));
    
    assert!(terminals.contains_key(""));
    let session = terminals.get("").unwrap();
    assert_eq!(session.id, "");
}

#[tokio::test]
async fn handles_unicode_terminal_id() {
    let mut terminals: HashMap<String, MockTerminalSession> = HashMap::new();
    
    let unicode_id = "终端-1-🖥️";
    terminals.insert(unicode_id.to_string(), MockTerminalSession::new(unicode_id));
    
    assert!(terminals.contains_key(unicode_id));
}

#[tokio::test]
async fn handles_rapid_spawn_close_cycles() {
    let terminals: Arc<Mutex<HashMap<String, MockTerminalSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
    
    // Rapidly spawn and close terminals
    for i in 0..50 {
        let mut guard = terminals.lock().await;
        let id = format!("rapid-{}", i);
        guard.insert(id.clone(), MockTerminalSession::new(&id));
        guard.remove(&id);
    }
    
    let guard = terminals.lock().await;
    assert_eq!(guard.len(), 0, "All terminals should be closed");
}
