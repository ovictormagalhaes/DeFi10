use std::fmt::Display;
use std::future::Future;
use std::time::Duration;

pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay: Duration,
    pub timeout: Option<Duration>,
    pub name: String,
}

impl RetryConfig {
    pub fn new(name: impl Into<String>, max_attempts: u32) -> Self {
        Self {
            max_attempts,
            base_delay: Duration::from_secs(3),
            timeout: None,
            name: name.into(),
        }
    }

    pub fn with_base_delay(mut self, delay: Duration) -> Self {
        self.base_delay = delay;
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }
}

pub async fn retry_async<F, Fut, T, E>(config: &RetryConfig, mut f: F) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: Display,
{
    retry_async_with_hook(config, &mut || async {}, &mut f).await
}

pub async fn retry_async_with_hook<F, Fut, H, HFut, T, E>(
    config: &RetryConfig,
    on_retry: &mut H,
    f: &mut F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    H: FnMut() -> HFut,
    HFut: Future<Output = ()>,
    E: Display,
{
    let mut last_err = None;
    for attempt in 1..=config.max_attempts {
        let result = match config.timeout {
            Some(timeout) => match tokio::time::timeout(timeout, f()).await {
                Ok(r) => r,
                Err(_) => {
                    tracing::warn!(
                        "{}: attempt {}/{} timed out ({}s)",
                        config.name,
                        attempt,
                        config.max_attempts,
                        timeout.as_secs()
                    );
                    if attempt < config.max_attempts {
                        on_retry().await;
                        let delay = config.base_delay * attempt;
                        tokio::time::sleep(delay).await;
                    }
                    continue;
                }
            },
            None => f().await,
        };

        match result {
            Ok(v) => return Ok(v),
            Err(e) => {
                if attempt < config.max_attempts {
                    tracing::warn!(
                        "{}: attempt {}/{} failed: {} — retrying in {}s",
                        config.name,
                        attempt,
                        config.max_attempts,
                        e,
                        config.base_delay.as_secs() * attempt as u64
                    );
                    on_retry().await;
                    let delay = config.base_delay * attempt;
                    tokio::time::sleep(delay).await;
                }
                last_err = Some(e);
            }
        }
    }
    Err(last_err.unwrap())
}
