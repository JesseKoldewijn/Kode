pub mod buffer;
pub mod languages;
pub mod parsing;
pub mod highlight;
pub mod editing;
pub mod history;
pub mod selection;
pub mod search;
pub mod folding;
pub mod symbols;
pub mod error;

pub use error::EditorError;

#[cfg(test)]
mod tests {
    #[test]
    fn ropey_basic_operations() {
        use ropey::Rope;
        let rope = Rope::from_str("Hello, world!");
        assert_eq!(rope.len_chars(), 13);
        assert_eq!(rope.len_lines(), 1);
    }

    #[test]
    fn tree_sitter_loads_javascript() {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&tree_sitter_javascript::LANGUAGE.into()).unwrap();
        let tree = parser.parse("const x = 42;", None).unwrap();
        assert_eq!(tree.root_node().kind(), "program");
    }
}
