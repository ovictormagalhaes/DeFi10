use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub mongodb: MongoConfig,
    pub redis: RedisConfig,
    pub rabbitmq: RabbitMqConfig,
    pub jwt: JwtConfig,
    #[serde(default = "default_cors_config")]
    pub cors: CorsConfig,
    #[serde(default = "default_rate_limiting")]
    pub rate_limiting: RateLimitingConfig,
    pub blockchain: BlockchainConfig,
    pub moralis: Option<MoralisConfig>,
    pub graph: Option<GraphConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GraphConfig {
    #[serde(alias = "apikey")]
    pub api_key: String,
    #[serde(default = "default_graph_url_template", alias = "urltemplate")]
    pub url_template: String,
    #[serde(default)]
    pub subgraphs: SubgraphIds,
}

fn default_graph_url_template() -> String {
    "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}".to_string()
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SubgraphIds {
    #[serde(default, alias = "aavev3base")]
    pub aave_v3_base: Option<String>,
    #[serde(default, alias = "aavev3ethereum")]
    pub aave_v3_ethereum: Option<String>,
    #[serde(default, alias = "aavev3arbitrum")]
    pub aave_v3_arbitrum: Option<String>,
    #[serde(default, alias = "uniswapv3ethereum")]
    pub uniswap_v3_ethereum: Option<String>,
    #[serde(default, alias = "uniswapv3base")]
    pub uniswap_v3_base: Option<String>,
    #[serde(default, alias = "uniswapv3arbitrum")]
    pub uniswap_v3_arbitrum: Option<String>,
}

impl GraphConfig {
    pub fn get_subgraph_url(&self, subgraph_id: &str) -> Option<String> {
        if self.api_key.is_empty() || subgraph_id.is_empty() {
            return None;
        }
        Some(
            self.url_template
                .replace("{API_KEY}", &self.api_key)
                .replace("{ID}", subgraph_id),
        )
    }
}

fn default_cors_config() -> CorsConfig {
    CorsConfig {
        allowed_origins: vec!["http://localhost:3000".to_string()],
    }
}

fn default_rate_limiting() -> RateLimitingConfig {
    RateLimitingConfig {
        enabled: false,
        max_requests: 100,
        window_seconds: 60,
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MongoConfig {
    pub uri: String,
    pub database: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    #[serde(alias = "poolsize")]
    pub pool_size: u32,
    #[serde(alias = "defaultttlseconds")]
    pub default_ttl_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RabbitMqConfig {
    pub url: String,
    #[serde(alias = "prefetchcount")]
    pub prefetch_count: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JwtConfig {
    pub secret: String,
    #[serde(alias = "expirationhours")]
    pub expiration_hours: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CorsConfig {
    #[serde(alias = "allowedorigins")]
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RateLimitingConfig {
    pub enabled: bool,
    #[serde(alias = "maxrequests")]
    pub max_requests: u32,
    #[serde(alias = "windowseconds")]
    pub window_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BlockchainConfig {
    #[serde(alias = "ethereumrpc")]
    pub ethereum_rpc: Option<String>,
    #[serde(alias = "baserpc")]
    pub base_rpc: Option<String>,
    #[serde(alias = "arbitrumrpc")]
    pub arbitrum_rpc: Option<String>,
    #[serde(alias = "bnbrpc")]
    pub bnb_rpc: Option<String>,
    #[serde(alias = "solanarpc")]
    pub solana_rpc: Option<String>,
    #[serde(alias = "alchemyapikey")]
    pub alchemy_api_key: Option<String>,
}

impl BlockchainConfig {
    pub fn get_solana_rpc(&self) -> Option<String> {
        if let Some(ref url) = self.solana_rpc {
            if !url.is_empty() && !url.contains("{API_KEY}") {
                return Some(url.clone());
            }
        }
        self.alchemy_api_key
            .as_ref()
            .map(|key| format!("https://solana-mainnet.g.alchemy.com/v2/{}", key))
    }

    pub fn get_ethereum_rpc(&self) -> Option<String> {
        if let Some(ref url) = self.ethereum_rpc {
            if !url.is_empty() && !url.contains("{API_KEY}") {
                return Some(url.clone());
            }
        }
        self.alchemy_api_key
            .as_ref()
            .map(|key| format!("https://eth-mainnet.g.alchemy.com/v2/{}", key))
    }

    pub fn get_base_rpc(&self) -> Option<String> {
        if let Some(ref url) = self.base_rpc {
            if !url.is_empty() && !url.contains("{API_KEY}") {
                return Some(url.clone());
            }
        }
        self.alchemy_api_key
            .as_ref()
            .map(|key| format!("https://base-mainnet.g.alchemy.com/v2/{}", key))
    }

    pub fn get_arbitrum_rpc(&self) -> Option<String> {
        if let Some(ref url) = self.arbitrum_rpc {
            if !url.is_empty() && !url.contains("{API_KEY}") {
                return Some(url.clone());
            }
        }
        self.alchemy_api_key
            .as_ref()
            .map(|key| format!("https://arb-mainnet.g.alchemy.com/v2/{}", key))
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct MoralisConfig {
    #[serde(default, alias = "apikey")]
    pub api_key: String,
    #[serde(default = "default_moralis_base_url", alias = "baseurl")]
    pub base_url: String,
    #[serde(default = "default_moralis_solana_url", alias = "solanabaseurl")]
    pub solana_base_url: String,
}

fn default_moralis_base_url() -> String {
    "https://deep-index.moralis.io/api/v2.2".to_string()
}

fn default_moralis_solana_url() -> String {
    "https://solana-gateway.moralis.io".to_string()
}

impl MoralisConfig {
    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty()
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 10000,
        }
    }
}

impl Default for RedisConfig {
    fn default() -> Self {
        Self {
            url: "redis://localhost:6379".to_string(),
            pool_size: 10,
            default_ttl_seconds: 300,
        }
    }
}

impl Default for RateLimitingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_requests: 100,
            window_seconds: 60,
        }
    }
}

pub fn load_config() -> Result<AppConfig, ConfigError> {
    // Load .env file if it exists (for local development)
    dotenvy::dotenv().ok();

    let env = env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());

    let config = Config::builder()
        // Start with default values
        .set_default("server.host", "0.0.0.0")?
        .set_default("server.port", 10000)?
        .set_default("redis.pool_size", 10)?
        .set_default("redis.default_ttl_seconds", 300)?
        .set_default("rate_limiting.enabled", true)?
        .set_default("rate_limiting.max_requests", 100)?
        .set_default("rate_limiting.window_seconds", 60)?
        .set_default("rabbitmq.prefetch_count", 10)?
        .set_default("jwt.expiration_hours", 24)?
        // Load config file (if exists)
        .add_source(File::with_name("config/default").required(false))
        .add_source(File::with_name(&format!("config/{}", env)).required(false))
        // Override with environment variables
        .add_source(Environment::default().separator("__"))
        .build()?;

    config.try_deserialize()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_server_config() {
        let config = ServerConfig::default();
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 10000);
    }

    #[test]
    fn test_default_redis_config() {
        let config = RedisConfig::default();
        assert_eq!(config.url, "redis://localhost:6379");
        assert_eq!(config.pool_size, 10);
        assert_eq!(config.default_ttl_seconds, 300);
    }

    #[test]
    fn test_default_rate_limiting_config() {
        let config = RateLimitingConfig::default();
        assert!(config.enabled);
        assert_eq!(config.max_requests, 100);
        assert_eq!(config.window_seconds, 60);
    }

    #[test]
    #[ignore]
    fn test_load_config_with_defaults() {
        // This will load config with defaults when env vars are not set
        // The test should not fail even without a config file
        std::env::set_var("DEFI10__MONGODB__URI", "mongodb://test:27017");
        std::env::set_var("DEFI10__MONGODB__DATABASE", "test_db");
        std::env::set_var("DEFI10__REDIS__URL", "redis://test:6379");
        std::env::set_var("DEFI10__RABBITMQ__URL", "amqp://test:5672");
        std::env::set_var("DEFI10__JWT__SECRET", "test_secret");
        std::env::set_var("DEFI10__CORS__ALLOWED_ORIGINS", "http://localhost:3000");

        let result = load_config();

        // Clean up
        std::env::remove_var("DEFI10__MONGODB__URI");
        std::env::remove_var("DEFI10__MONGODB__DATABASE");
        std::env::remove_var("DEFI10__REDIS__URL");
        std::env::remove_var("DEFI10__RABBITMQ__URL");
        std::env::remove_var("DEFI10__JWT__SECRET");
        std::env::remove_var("DEFI10__CORS__ALLOWED_ORIGINS");

        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(config.server.port, 10000);
        assert_eq!(config.mongodb.uri, "mongodb://test:27017");
    }

    #[test]
    #[ignore]
    fn test_config_from_env_vars() {
        std::env::set_var("DEFI10__SERVER__PORT", "8080");
        std::env::set_var("DEFI10__MONGODB__URI", "mongodb://localhost:27017");
        std::env::set_var("DEFI10__MONGODB__DATABASE", "defi10_test");
        std::env::set_var("DEFI10__REDIS__URL", "redis://localhost:6379");
        std::env::set_var("DEFI10__RABBITMQ__URL", "amqp://localhost:5672");
        std::env::set_var("DEFI10__JWT__SECRET", "secret123");
        std::env::set_var("DEFI10__CORS__ALLOWED_ORIGINS", "http://localhost:3000");

        let result = load_config();

        // Clean up
        std::env::remove_var("DEFI10__SERVER__PORT");
        std::env::remove_var("DEFI10__MONGODB__URI");
        std::env::remove_var("DEFI10__MONGODB__DATABASE");
        std::env::remove_var("DEFI10__REDIS__URL");
        std::env::remove_var("DEFI10__RABBITMQ__URL");
        std::env::remove_var("DEFI10__JWT__SECRET");
        std::env::remove_var("DEFI10__CORS__ALLOWED_ORIGINS");

        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(config.server.port, 8080);
        assert_eq!(config.mongodb.database, "defi10_test");
    }
}
