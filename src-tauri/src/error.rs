use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("time format error: {0}")]
    TimeFormat(#[from] time::error::Format),
    #[error("time parse error: {0}")]
    TimeParse(#[from] time::error::Parse),
    #[error("time conversion error: {0}")]
    TimeConversion(#[from] time::error::ComponentRange),
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("system clock error: {0}")]
    Time(#[from] std::time::SystemTimeError),
    #[error("unsupported save version: {0}")]
    UnsupportedVersion(u8),
    #[error("validation error: {0}")]
    Validation(&'static str),
}

pub type AppResult<T> = Result<T, AppError>;
