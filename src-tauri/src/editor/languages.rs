use serde::{Deserialize, Serialize};
use std::path::Path;
use tree_sitter::Language;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LanguageId {
    JavaScript,
    TypeScript,
    Tsx,
    Jsx,
    Json,
    Html,
    Css,
    Rust,
    Python,
    Markdown,
    Yaml,
    Toml,
    Go,
    C,
    Cpp,
    Bash,
    Ripple,
    Plaintext,
}

#[allow(dead_code)]
pub struct LanguageConfig {
    pub id: LanguageId,
    pub name: &'static str,
    pub extensions: &'static [&'static str],
    pub language: Language,
    pub highlight_query: &'static str,
}

pub fn detect_language(path: &Path) -> LanguageId {
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "js" | "mjs" | "cjs" => LanguageId::JavaScript,
        "ts" | "mts" | "cts" => LanguageId::TypeScript,
        "tsx" => LanguageId::Tsx,
        "jsx" => LanguageId::Jsx,
        "json" => LanguageId::Json,
        "html" | "htm" => LanguageId::Html,
        "css" => LanguageId::Css,
        "rs" => LanguageId::Rust,
        "py" | "pyw" => LanguageId::Python,
        "md" | "markdown" => LanguageId::Markdown,
        "yaml" | "yml" => LanguageId::Yaml,
        "toml" => LanguageId::Toml,
        "go" => LanguageId::Go,
        "c" | "h" => LanguageId::C,
        "cpp" | "hpp" | "cc" | "hh" | "cxx" | "hxx" => LanguageId::Cpp,
        "sh" | "bash" | "zsh" => LanguageId::Bash,
        "ripple" => LanguageId::Ripple,
        _ => LanguageId::Plaintext,
    }
}

pub fn get_language(id: LanguageId) -> Option<Language> {
    match id {
        LanguageId::JavaScript => Some(tree_sitter_javascript::LANGUAGE.into()),
        LanguageId::TypeScript => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        LanguageId::Tsx => Some(tree_sitter_typescript::LANGUAGE_TSX.into()),
        LanguageId::Jsx => Some(tree_sitter_javascript::LANGUAGE.into()),
        LanguageId::Json => Some(tree_sitter_json::LANGUAGE.into()),
        LanguageId::Html => Some(tree_sitter_html::LANGUAGE.into()),
        LanguageId::Css => Some(tree_sitter_css::LANGUAGE.into()),
        LanguageId::Rust => Some(tree_sitter_rust::LANGUAGE.into()),
        LanguageId::Python => Some(tree_sitter_python::LANGUAGE.into()),
        LanguageId::Markdown => None, // Markdown grammar v0.7 doesn't expose standard API
        LanguageId::Yaml => Some(tree_sitter_yaml::LANGUAGE.into()),
        LanguageId::Toml => Some(tree_sitter_toml_ng::LANGUAGE.into()),
        LanguageId::Go => Some(tree_sitter_go::LANGUAGE.into()),
        LanguageId::C => Some(tree_sitter_c::LANGUAGE.into()),
        LanguageId::Cpp => Some(tree_sitter_cpp::LANGUAGE.into()),
        LanguageId::Bash => Some(tree_sitter_bash::LANGUAGE.into()),
        LanguageId::Ripple => None,
        LanguageId::Plaintext => None,
    }
}

pub fn get_highlight_query(id: LanguageId) -> &'static str {
    match id {
        LanguageId::JavaScript => tree_sitter_javascript::HIGHLIGHT_QUERY,
        LanguageId::TypeScript => tree_sitter_typescript::HIGHLIGHTS_QUERY,
        LanguageId::Tsx => tree_sitter_typescript::HIGHLIGHTS_QUERY,
        LanguageId::Jsx => tree_sitter_javascript::HIGHLIGHT_QUERY,
        LanguageId::Json => tree_sitter_json::HIGHLIGHTS_QUERY,
        LanguageId::Html => tree_sitter_html::HIGHLIGHTS_QUERY,
        LanguageId::Css => tree_sitter_css::HIGHLIGHTS_QUERY,
        LanguageId::Rust => tree_sitter_rust::HIGHLIGHTS_QUERY,
        LanguageId::Python => tree_sitter_python::HIGHLIGHTS_QUERY,
        LanguageId::Markdown => "", // Markdown grammar v0.7 doesn't expose highlight queries
        LanguageId::Yaml => tree_sitter_yaml::HIGHLIGHTS_QUERY,
        LanguageId::Toml => tree_sitter_toml_ng::HIGHLIGHTS_QUERY,
        LanguageId::Go => tree_sitter_go::HIGHLIGHTS_QUERY,
        LanguageId::C => tree_sitter_c::HIGHLIGHT_QUERY,
        LanguageId::Cpp => tree_sitter_cpp::HIGHLIGHT_QUERY,
        LanguageId::Bash => tree_sitter_bash::HIGHLIGHT_QUERY,
        LanguageId::Ripple => "",
        LanguageId::Plaintext => "",
    }
}
