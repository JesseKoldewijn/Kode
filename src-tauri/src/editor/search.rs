use crate::editor::buffer::Buffer;
use crate::editor::error::{EditorError, Result};
use regex::Regex;
use serde::Serialize;

/// A single search result within a buffer.
///
/// This mirrors the structure described in LSP_MIGRATION_PLAN:
/// - lineNumber: 0-based line index
/// - startCol / endCol: 0-based columns (end exclusive)
/// - lineText: full line content
/// - matchText: substring that matched
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub line_number: u32,
    pub start_col: u32,
    pub end_col: u32,
    pub line_text: String,
    pub match_text: String,
}

/// Options controlling how searches are performed.
#[derive(Debug, Clone)]
pub struct SearchOptions {
    pub is_regex: bool,
    pub case_sensitive: bool,
}

impl Default for SearchOptions {
    fn default() -> Self {
        SearchOptions {
            is_regex: false,
            case_sensitive: false,
        }
    }
}

/// Perform an in-memory search over the given buffer.
///
/// This implementation is intentionally simple and robust:
/// - Uses regex crate when `is_regex` is true
/// - Falls back to substring search otherwise
/// - Operates line-by-line to keep column calculations straightforward
pub fn search_in_buffer(
    buffer: &Buffer,
    query: &str,
    options: SearchOptions,
) -> Result<Vec<SearchMatch>> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let total_lines = buffer.rope.len_lines();
    let mut results = Vec::new();

    if options.is_regex {
        // Build regex, optionally wrapping with case-insensitive flag
        let pattern = if options.case_sensitive {
            query.to_string()
        } else {
            // Use inline case-insensitive flag; if user already provided flags this
            // may be redundant but still valid.
            format!("(?i:{})", query)
        };

        let re = Regex::new(&pattern).map_err(|e| {
            EditorError::Unknown(format!("Invalid regex pattern '{}': {}", query, e))
        })?;

        for line_idx in 0..total_lines {
            let line_text = buffer.rope.line(line_idx).to_string();

            if let Some(m) = re.find(&line_text) {
                results.push(SearchMatch {
                    line_number: line_idx as u32,
                    start_col: m.start() as u32,
                    end_col: m.end() as u32,
                    line_text: line_text.clone(),
                    match_text: m.as_str().to_string(),
                });
            }
        }
    } else {
        // Plain substring search
        let needle = if options.case_sensitive {
            query.to_string()
        } else {
            query.to_lowercase()
        };

        for line_idx in 0..total_lines {
            let line_text = buffer.rope.line(line_idx).to_string();
            let haystack = if options.case_sensitive {
                line_text.clone()
            } else {
                line_text.to_lowercase()
            };

            let mut search_start = 0usize;
            while search_start <= haystack.len() {
                match haystack[search_start..].find(&needle) {
                    Some(rel_pos) => {
                        let start = search_start + rel_pos;
                        let end = start + needle.len();
                        results.push(SearchMatch {
                            line_number: line_idx as u32,
                            start_col: start as u32,
                            end_col: end as u32,
                            line_text: line_text.clone(),
                            match_text: line_text[start..end].to_string(),
                        });
                        // Move past this match
                        search_start = end;
                    }
                    None => break,
                }
            }
        }
    }

    Ok(results)
}
