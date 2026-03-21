use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_tracing() {
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,defi10=debug"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_tracing() {
        // This test just ensures init_tracing doesn't panic
        // We can only call it once per process, so we wrap in a guard
        static INIT: std::sync::Once = std::sync::Once::new();

        INIT.call_once(|| {
            init_tracing();
        });
    }
}
