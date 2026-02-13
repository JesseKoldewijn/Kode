use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use kode_lib::editor::buffer::Buffer;
use kode_lib::editor::highlight::get_viewport_highlights;
use kode_lib::editor::parsing::update_tree;
use kode_lib::editor::search::{search_in_buffer, SearchOptions};
use tree_sitter::InputEdit;

fn make_js_buffer(lines: usize) -> Buffer {
    let content = (0..lines)
        .map(|i| format!("const value{} = {};\n", i, i))
        .collect::<String>();
    Buffer::new("bench.js".to_string(), &content, None)
}

fn bench_parsing(c: &mut Criterion) {
    let mut group = c.benchmark_group("parsing");

    for &lines in &[100usize, 1_000, 10_000] {
        group.bench_with_input(
            BenchmarkId::new("initial_parse_js", lines),
            &lines,
            |b, &l| {
                b.iter(|| {
                    let mut buffer = make_js_buffer(l);
                    // Force initial parse
                    buffer.parse_if_needed();
                });
            },
        );
    }

    group.finish();
}

fn bench_highlighting(c: &mut Criterion) {
    let mut group = c.benchmark_group("highlighting");

    let mut buffer = make_js_buffer(5_000);
    buffer.parse_if_needed();

    group.bench_function("highlight_50_lines", |b| {
        b.iter(|| {
            get_viewport_highlights(&buffer, 0, 50);
        });
    });

    group.finish();
}

fn bench_edit_pipeline(c: &mut Criterion) {
    let mut group = c.benchmark_group("edit_pipeline");

    let mut buffer = make_js_buffer(10_000);
    buffer.parse_if_needed();

    group.bench_function("single_char_edit_parse_highlight", |b| {
        b.iter(|| {
            let start_byte = buffer.rope.len_bytes().saturating_sub(1);
            let edit = InputEdit {
                start_byte,
                old_end_byte: start_byte,
                new_end_byte: start_byte + 1,
                start_position: tree_sitter::Point::new(
                    buffer.rope.len_lines().saturating_sub(1),
                    0,
                ),
                old_end_position: tree_sitter::Point::new(
                    buffer.rope.len_lines().saturating_sub(1),
                    0,
                ),
                new_end_position: tree_sitter::Point::new(
                    buffer.rope.len_lines().saturating_sub(1),
                    1,
                ),
            };

            update_tree(&mut buffer, Some(edit));
            get_viewport_highlights(&buffer, 0, 50);
        });
    });

    group.finish();
}

fn bench_search(c: &mut Criterion) {
    let mut group = c.benchmark_group("search");

    let buffer = make_js_buffer(10_000);

    group.bench_function("literal_search", |b| {
        b.iter(|| {
            let _ = search_in_buffer(
                &buffer,
                "value42",
                SearchOptions {
                    is_regex: false,
                    case_sensitive: false,
                },
            );
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_parsing,
    bench_highlighting,
    bench_edit_pipeline,
    bench_search
);
criterion_main!(benches);
