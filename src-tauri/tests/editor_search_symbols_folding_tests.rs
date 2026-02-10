use kode_lib::editor::buffer::Buffer;
use kode_lib::editor::folding::{compute_fold_ranges, FoldKind};
use kode_lib::editor::search::{search_in_buffer, SearchOptions};
use kode_lib::editor::symbols::extract_document_symbols;

#[test]
fn search_in_buffer_finds_literal_occurrence() {
    let content = "const foo = 1;\nconst bar = foo + 1;";
    let buffer = Buffer::new("search.js".to_string(), content, None);

    let results = search_in_buffer(
        &buffer,
        "foo",
        SearchOptions {
            is_regex: false,
            case_sensitive: false,
        },
    )
    .expect("search should succeed");

    assert!(!results.is_empty());
    assert!(results.iter().any(|m| m.line_number == 0));
    assert!(results.iter().any(|m| m.line_number == 1));
}

#[test]
fn search_in_buffer_respects_case_sensitivity() {
    let content = "const Foo = 1;\nconst foo = 2;";
    let buffer = Buffer::new("search_case.js".to_string(), content, None);

    let insensitive = search_in_buffer(
        &buffer,
        "foo",
        SearchOptions {
            is_regex: false,
            case_sensitive: false,
        },
    )
    .expect("search should succeed");
    assert_eq!(insensitive.len(), 2);

    let sensitive = search_in_buffer(
        &buffer,
        "foo",
        SearchOptions {
            is_regex: true,
            case_sensitive: true,
        },
    )
    .expect("search should succeed");
    assert_eq!(sensitive.len(), 1);
}

#[test]
fn extract_document_symbols_returns_functions() {
    let content = "function foo() {}\nfunction bar() {}";
    let mut buffer = Buffer::new("symbols.js".to_string(), content, None);
    buffer.parse_if_needed();

    let symbols = extract_document_symbols(&buffer);
    assert!(!symbols.is_empty());
    let names: Vec<_> = symbols.iter().map(|s| s.name.as_str()).collect();
    assert!(names.contains(&"foo"));
    assert!(names.contains(&"bar"));
}

#[test]
fn compute_fold_ranges_detects_block_ranges() {
    let content = r#"
function foo() {
  if (true) {
    console.log('inside');
  }
}
"#;
    let mut buffer = Buffer::new("fold.js".to_string(), content, None);
    buffer.parse_if_needed();

    let ranges = compute_fold_ranges(&buffer);
    assert!(!ranges.is_empty());

    assert!(ranges.iter().any(|r| matches!(r.kind, FoldKind::Block)));
}

#[test]
fn compute_fold_ranges_detects_import_group() {
    let content = r#"
import a from 'a';
import b from 'b';
import c from 'c';

function main() {
  console.log(a, b, c);
}
"#;
    let mut buffer = Buffer::new("imports.js".to_string(), content, None);
    buffer.parse_if_needed();

    let ranges = compute_fold_ranges(&buffer);
    assert!(!ranges.is_empty());

    assert!(ranges.iter().any(|r| matches!(r.kind, FoldKind::Import)));
}

#[test]
fn compute_fold_ranges_detects_multiline_comment() {
    let content = r#"
/**
 * This is a
 * multi-line comment
 */
function foo() {
  return 1;
}
"#;
    let mut buffer = Buffer::new("comments.js".to_string(), content, None);
    buffer.parse_if_needed();

    let ranges = compute_fold_ranges(&buffer);
    assert!(!ranges.is_empty());

    assert!(ranges.iter().any(|r| matches!(r.kind, FoldKind::Comment)));
}

