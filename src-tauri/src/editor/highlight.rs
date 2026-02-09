use crate::editor::buffer::Buffer;
use crate::editor::languages::{get_highlight_query, get_language, LanguageId};
use lazy_static::lazy_static;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tree_sitter_highlight::{HighlightConfiguration, HighlightEvent, Highlighter};

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HighlightSpan {
    pub start_col: u32,
    pub end_col: u32,
    pub scope: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HighlightedLine {
    pub line_number: u32,
    pub text: String,
    pub spans: Vec<HighlightSpan>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ViewportHighlights {
    pub buffer_id: String,
    pub version: u64,
    pub lines: Vec<HighlightedLine>,
    pub total_lines: u32,
}

// Highlight names recognized by tree-sitter
const HIGHLIGHT_NAMES: &[&str] = &[
    "keyword",
    "string",
    "comment",
    "function",
    "variable",
    "number",
    "type",
    "constant",
    "operator",
    "property",
    "attribute",
    "tag",
    "punctuation",
];

lazy_static! {
    // Cache HighlightConfiguration per language to avoid recompiling queries on every highlight request
    static ref HIGHLIGHT_CONFIG_CACHE: Mutex<HashMap<LanguageId, Arc<HighlightConfiguration>>> =
        Mutex::new(HashMap::new());
}

/// Get or create cached HighlightConfiguration for a language
fn get_highlight_config(language_id: LanguageId) -> Option<Arc<HighlightConfiguration>> {
    // Try to get from cache first
    {
        let cache = HIGHLIGHT_CONFIG_CACHE.lock().unwrap();
        if let Some(config) = cache.get(&language_id) {
            return Some(Arc::clone(config));
        }
    }

    // Not in cache, create new config
    let lang = get_language(language_id)?;
    let mut config = match HighlightConfiguration::new(
        lang,
        "syntax",
        get_highlight_query(language_id),
        "", // injection
        "", // locals
    ) {
        Ok(c) => c,
        Err(_) => return None,
    };

    // Configure highlight names
    config.configure(HIGHLIGHT_NAMES);

    // Cache and return
    let config_arc = Arc::new(config);
    let mut cache = HIGHLIGHT_CONFIG_CACHE.lock().unwrap();
    cache.insert(language_id, Arc::clone(&config_arc));

    Some(config_arc)
}

pub fn get_viewport_highlights(
    buffer: &Buffer,
    start_line: u32,
    end_line: u32,
) -> ViewportHighlights {
    let mut lines = Vec::new();
    let total_lines = buffer.rope.len_lines() as u32;

    let mut highlighter = Highlighter::new();

    // Get cached highlight config for this language
    let config = match get_highlight_config(buffer.language) {
        Some(c) => c,
        None => {
            // Return plaintext if no language config available
            for i in start_line..std::cmp::min(end_line, total_lines) {
                let line = buffer.rope.line(i as usize);
                lines.push(HighlightedLine {
                    line_number: i,
                    text: line.to_string(),
                    spans: Vec::new(),
                });
            }
            return ViewportHighlights {
                buffer_id: buffer.id.clone(),
                version: buffer.version,
                lines,
                total_lines,
            };
        }
    };

    // Get highlights for the range
    let start_byte = buffer.rope.line_to_byte(start_line as usize);
    let end_byte = if end_line as usize >= buffer.rope.len_lines() {
        buffer.rope.len_bytes()
    } else {
        buffer.rope.line_to_byte(end_line as usize)
    };

    // Only collect bytes for the viewport range (not the entire file)
    let source_bytes: Vec<u8> = buffer
        .rope
        .byte_slice(start_byte..end_byte)
        .bytes()
        .collect();

    let highlights = match highlighter.highlight(&config, &source_bytes[..], None, |_| None) {
        Ok(h) => h,
        Err(_) => {
            // If highlighting fails, return plaintext
            for i in start_line..std::cmp::min(end_line, total_lines) {
                let line = buffer.rope.line(i as usize);
                lines.push(HighlightedLine {
                    line_number: i,
                    text: line.to_string(),
                    spans: Vec::new(),
                });
            }
            return ViewportHighlights {
                buffer_id: buffer.id.clone(),
                version: buffer.version,
                lines,
                total_lines,
            };
        }
    };

    // Build a line-based structure
    let mut line_map: HashMap<u32, (String, Vec<HighlightSpan>)> = HashMap::new();

    // Initialize all lines in the range
    for i in start_line..std::cmp::min(end_line, total_lines) {
        let line_text = buffer.rope.line(i as usize).to_string();
        line_map.insert(i, (line_text, Vec::new()));
    }

    // Process highlights
    let mut byte_offset = start_byte;
    let mut highlight_stack: Vec<(usize, usize)> = Vec::new(); // (scope_index, byte_start)

    for event in highlights {
        match event {
            Ok(HighlightEvent::Source { start, end }) => {
                let absolute_start = start_byte + start;
                let absolute_end = start_byte + end;

                // If we have an active highlight, create a span
                if let Some(&(scope_idx, span_start)) = highlight_stack.last() {
                    let scope = HIGHLIGHT_NAMES[scope_idx].to_string();

                    // Convert byte positions to line/col
                    let start_line_idx = buffer.rope.byte_to_line(span_start.max(absolute_start));
                    let end_line_idx = buffer.rope.byte_to_line(absolute_end);

                    // Handle single-line spans
                    if start_line_idx == end_line_idx {
                        let line_num = start_line_idx as u32;
                        if line_num >= start_line && line_num < end_line {
                            if let Some((_, spans)) = line_map.get_mut(&line_num) {
                                let line_start_byte = buffer.rope.line_to_byte(start_line_idx);
                                let start_col =
                                    buffer.rope.byte_to_char(span_start.max(absolute_start))
                                        - buffer.rope.byte_to_char(line_start_byte);
                                let end_col = buffer.rope.byte_to_char(absolute_end)
                                    - buffer.rope.byte_to_char(line_start_byte);

                                spans.push(HighlightSpan {
                                    start_col: start_col as u32,
                                    end_col: end_col as u32,
                                    scope: scope.clone(),
                                });
                            }
                        }
                    } else {
                        // Multi-line spans (split across lines)
                        for line_idx in start_line_idx..=end_line_idx {
                            let line_num = line_idx as u32;
                            if line_num >= start_line && line_num < end_line {
                                if let Some((_line_text, spans)) = line_map.get_mut(&line_num) {
                                    let line_start_byte = buffer.rope.line_to_byte(line_idx);
                                    let line_end_byte = if line_idx + 1 < buffer.rope.len_lines() {
                                        buffer.rope.line_to_byte(line_idx + 1)
                                    } else {
                                        buffer.rope.len_bytes()
                                    };

                                    let span_start_in_line = if line_idx == start_line_idx {
                                        span_start.max(absolute_start)
                                    } else {
                                        line_start_byte
                                    };

                                    let span_end_in_line = if line_idx == end_line_idx {
                                        absolute_end
                                    } else {
                                        line_end_byte
                                    };

                                    let start_col = buffer.rope.byte_to_char(span_start_in_line)
                                        - buffer.rope.byte_to_char(line_start_byte);
                                    let end_col = buffer.rope.byte_to_char(span_end_in_line)
                                        - buffer.rope.byte_to_char(line_start_byte);

                                    spans.push(HighlightSpan {
                                        start_col: start_col as u32,
                                        end_col: end_col as u32,
                                        scope: scope.clone(),
                                    });
                                }
                            }
                        }
                    }
                }

                byte_offset = absolute_end;
            }
            Ok(HighlightEvent::HighlightStart(s)) => {
                highlight_stack.push((s.0, byte_offset));
            }
            Ok(HighlightEvent::HighlightEnd) => {
                highlight_stack.pop();
            }
            Err(_) => {}
        }
    }

    // Convert line_map to sorted lines
    for i in start_line..std::cmp::min(end_line, total_lines) {
        if let Some((text, spans)) = line_map.remove(&i) {
            lines.push(HighlightedLine {
                line_number: i,
                text,
                spans,
            });
        }
    }

    ViewportHighlights {
        buffer_id: buffer.id.clone(),
        version: buffer.version,
        lines,
        total_lines,
    }
}
