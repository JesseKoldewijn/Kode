use crate::editor::error::Result;
use crate::editor::history::History;
use crate::editor::languages::{detect_language, get_language, LanguageId};
use crate::editor::selection::SelectionSet;
use lazy_static::lazy_static;
use ropey::Rope;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tree_sitter::{Parser, Tree};

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
#[allow(clippy::upper_case_acronyms)]
pub enum LineEnding {
    LF,
    CRLF,
    CR,
}

pub struct Buffer {
    pub id: String,
    pub rope: Rope,
    pub language: LanguageId,
    pub tree: Option<Tree>,
    pub version: u64,
    #[allow(dead_code)]
    pub file_path: Option<PathBuf>,
    pub is_dirty: bool,
    pub line_ending: LineEnding,
    pub selections: SelectionSet,
    pub history: History,
}

impl Buffer {
    pub fn new(id: String, content: &str, file_path: Option<PathBuf>) -> Self {
        let rope = Rope::from_str(content);
        let language = file_path
            .as_ref()
            .map(|p| detect_language(p))
            .unwrap_or(LanguageId::Plaintext);

        let selections = SelectionSet::new(id.clone());

        Buffer {
            id,
            rope,
            language,
            tree: None,
            version: 0,
            file_path,
            is_dirty: false,
            line_ending: LineEnding::LF,
            selections,
            history: History::new(),
        }
    }

    pub fn parse_if_needed(&mut self) {
        log::info!(
            "[parse_if_needed] START: id={}, language={:?}, tree_exists={}",
            self.id,
            self.language,
            self.tree.is_some()
        );

        if self.tree.is_some() {
            log::info!("[parse_if_needed] SKIP (already parsed): id={}", self.id);
            return; // Already parsed
        }

        if let Some(lang) = get_language(self.language) {
            log::info!(
                "[parse_if_needed] Creating parser: id={}, bytes={}",
                self.id,
                self.rope.len_bytes()
            );
            let parse_start = std::time::Instant::now();
            let mut parser = Parser::new();
            if parser.set_language(&lang).is_ok() {
                self.tree = parser.parse_with(
                    &mut |byte, _| -> &[u8] {
                        if byte >= self.rope.len_bytes() {
                            return &[];
                        }
                        let (chunk, chunk_byte, _, _) = self.rope.chunk_at_byte(byte);
                        &chunk.as_bytes()[byte - chunk_byte..]
                    },
                    None,
                );
                let parse_duration = parse_start.elapsed();
                log::info!(
                    "[parse_if_needed] COMPLETE: id={}, duration={:?}, success={}",
                    self.id,
                    parse_duration,
                    self.tree.is_some()
                );
            } else {
                log::warn!(
                    "[parse_if_needed] Failed to set language: id={}, language={:?}",
                    self.id,
                    self.language
                );
            }
        } else {
            log::info!(
                "[parse_if_needed] No language support: id={}, language={:?}",
                self.id,
                self.language
            );
        }
    }
}

pub struct BufferManager {
    buffers: HashMap<String, Arc<RwLock<Buffer>>>,
}

impl BufferManager {
    pub fn new() -> Self {
        BufferManager {
            buffers: HashMap::new(),
        }
    }

    pub fn open(
        &mut self,
        id: String,
        content: &str,
        file_path: Option<PathBuf>,
    ) -> Result<String> {
        let buffer = Buffer::new(id.clone(), content, file_path);
        let arc = Arc::new(RwLock::new(buffer));
        self.buffers.insert(id.clone(), arc);
        Ok(id)
    }

    pub fn close(&mut self, id: &str) {
        self.buffers.remove(id);
    }

    pub fn get(&self, id: &str) -> Option<Arc<RwLock<Buffer>>> {
        self.buffers.get(id).cloned()
    }
}

lazy_static! {
    pub static ref MANAGER: Arc<RwLock<BufferManager>> =
        Arc::new(RwLock::new(BufferManager::new()));
}
