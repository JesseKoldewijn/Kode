use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum EditorError {
    #[error("Buffer not found: {0}")]
    BufferNotFound(String),

    #[allow(dead_code)]
    #[error("Invalid range: {0}")]
    InvalidRange(String),

    #[allow(dead_code)]
    #[error("Language not supported: {0}")]
    LanguageNotSupported(String),

    #[allow(dead_code)]
    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("IO error: {0}")]
    Io(String),

    #[allow(dead_code)]
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<std::io::Error> for EditorError {
    fn from(err: std::io::Error) -> Self {
        EditorError::Io(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, EditorError>;
