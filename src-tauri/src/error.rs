use thiserror::Error;

#[derive(Debug, Error)]
pub enum MuckError {
    #[error("{0}")]
    Msg(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
}

impl From<anyhow::Error> for MuckError {
    fn from(value: anyhow::Error) -> Self {
        MuckError::Msg(value.to_string())
    }
}

impl From<MuckError> for String {
    fn from(value: MuckError) -> Self {
        value.to_string()
    }
}

#[allow(dead_code)]
pub type MuckResult<T> = Result<T, MuckError>;
