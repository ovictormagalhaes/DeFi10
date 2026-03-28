use crate::config::NewRelicConfig;
use opentelemetry::trace::TracerProvider as _;
use opentelemetry::{KeyValue, trace::TraceError};
use opentelemetry_otlp::{WithExportConfig, WithTonicConfig};
use opentelemetry_sdk::{runtime, trace::TracerProvider, Resource};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static PROVIDER: std::sync::OnceLock<TracerProvider> = std::sync::OnceLock::new();

pub fn init_tracing() {
    init_tracing_with_newrelic(None);
}

pub fn init_tracing_with_newrelic(nr_config: Option<&NewRelicConfig>) {
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,defi10=debug"));

    let registry = tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().json());

    if let Some(config) = nr_config {
        match build_otlp_provider(config) {
            Ok(provider) => {
                let tracer = provider.tracer(config.service_name.clone());
                let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
                PROVIDER.set(provider).ok();
                registry.with(Some(otel_layer)).init();
                tracing::info!("Tracing initialized with New Relic OTLP exporter");
                return;
            }
            Err(e) => {
                eprintln!("Failed to init New Relic OTLP exporter, falling back to stdout: {e}");
            }
        }
    }

    registry.init();
}

fn build_otlp_provider(config: &NewRelicConfig) -> Result<TracerProvider, TraceError> {
    let mut metadata = tonic::metadata::MetadataMap::new();
    metadata.insert(
        "api-key",
        config
            .license_key
            .parse()
            .map_err(|_| TraceError::Other("Invalid New Relic license key".into()))?,
    );

    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(&config.otlp_endpoint)
        .with_metadata(metadata)
        .build()?;

    let provider = TracerProvider::builder()
        .with_batch_exporter(exporter, runtime::Tokio)
        .with_resource(Resource::new(vec![KeyValue::new(
            "service.name",
            config.service_name.clone(),
        )]))
        .build();

    Ok(provider)
}

pub fn shutdown_tracing() {
    if let Some(provider) = PROVIDER.get() {
        if let Err(e) = provider.shutdown() {
            eprintln!("Error shutting down tracer provider: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_tracing() {
        static INIT: std::sync::Once = std::sync::Once::new();

        INIT.call_once(|| {
            init_tracing();
        });
    }
}
