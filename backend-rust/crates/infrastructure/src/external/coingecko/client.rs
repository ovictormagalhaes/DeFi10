use super::models::*;
use defi10_core::http_helpers::check_and_parse;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

const COINGECKO_API_URL: &str = "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY_HEADER: &str = "x-cg-demo-api-key";

pub struct CoingeckoClient {
    client: Arc<Client>,
    base_url: String,
    api_key: Option<String>,
}

impl CoingeckoClient {
    pub fn new() -> Self {
        let api_key = std::env::var("COINGECKO_API_KEY").ok();
        Self {
            client: Arc::new(
                Client::builder()
                    .timeout(Duration::from_secs(30))
                    .build()
                    .expect("Failed to create HTTP client"),
            ),
            base_url: COINGECKO_API_URL.to_string(),
            api_key,
        }
    }

    pub fn with_client(client: Arc<Client>) -> Self {
        let api_key = std::env::var("COINGECKO_API_KEY").ok();
        Self {
            client,
            base_url: COINGECKO_API_URL.to_string(),
            api_key,
        }
    }

    fn get(&self, url: &str) -> reqwest::RequestBuilder {
        let req = self.client.get(url);
        match &self.api_key {
            Some(key) => req.header(COINGECKO_API_KEY_HEADER, key),
            None => req,
        }
    }

    pub async fn get_prices(
        &self,
        coin_ids: &[&str],
    ) -> Result<HashMap<String, f64>, anyhow::Error> {
        if coin_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let ids = coin_ids.join(",");
        let url = format!(
            "{}/simple/price?ids={}&vs_currencies=usd&include_24hr_change=true",
            self.base_url, ids
        );

        tracing::debug!("[Coingecko] Fetching prices for: {}", ids);

        let response = self.get(&url).send().await?;

        let data: HashMap<String, CoinPrice> = check_and_parse(response, "Coingecko API").await?;

        let prices: HashMap<String, f64> = data
            .into_iter()
            .filter_map(|(id, price)| price.usd.map(|p| (id, p)))
            .collect();

        tracing::debug!("[Coingecko] Retrieved {} prices", prices.len());

        Ok(prices)
    }

    pub async fn get_token_price_by_contract(
        &self,
        platform: &str,
        contract_address: &str,
    ) -> Result<Option<f64>, anyhow::Error> {
        let url = format!(
            "{}/simple/token_price/{}?contract_addresses={}&vs_currencies=usd",
            self.base_url,
            platform,
            contract_address.to_lowercase()
        );

        tracing::debug!(
            "[Coingecko] Fetching token price: {}/{}",
            platform,
            contract_address
        );

        let response = self.get(&url).send().await?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let data: HashMap<String, CoinPrice> = response.json().await?;

        let price = data.values().next().and_then(|p| p.usd);

        Ok(price)
    }

    pub async fn get_markets(&self, coin_ids: &[&str]) -> Result<Vec<CoinMarket>, anyhow::Error> {
        if coin_ids.is_empty() {
            return Ok(Vec::new());
        }

        let ids = coin_ids.join(",");
        let url = format!(
            "{}/coins/markets?vs_currency=usd&ids={}&price_change_percentage=1h,24h,7d,14d,30d,200d,1y&sparkline=false",
            self.base_url, ids
        );

        tracing::debug!("[Coingecko] Fetching markets for: {}", ids);

        let response = self.get(&url).send().await?;
        let data: Vec<CoinMarket> = check_and_parse(response, "Coingecko markets").await?;

        tracing::debug!("[Coingecko] Got {} markets entries", data.len());

        Ok(data)
    }

    pub async fn get_market_chart_range(
        &self,
        coin_id: &str,
        from: i64,
        to: i64,
    ) -> Result<Vec<(i64, f64)>, anyhow::Error> {
        let url = format!(
            "{}/coins/{}/market_chart/range?vs_currency=usd&from={}&to={}",
            self.base_url, coin_id, from, to
        );

        tracing::debug!(
            "[Coingecko] Fetching market chart for {} ({} - {})",
            coin_id,
            from,
            to
        );

        let response = self.get(&url).send().await?;
        let data: MarketChartResponse = check_and_parse(response, "Coingecko market_chart").await?;

        tracing::debug!(
            "[Coingecko] Got {} price points for {}",
            data.prices.len(),
            coin_id
        );

        Ok(data.prices)
    }
}

impl Default for CoingeckoClient {
    fn default() -> Self {
        Self::new()
    }
}

pub fn symbol_to_coingecko_id(symbol: &str) -> Option<&'static str> {
    match symbol.to_uppercase().as_str() {
        "ETH" | "WETH" => Some("ethereum"),
        "BTC" | "WBTC" | "CBBTC" => Some("bitcoin"),
        "USDC" => Some("usd-coin"),
        "USDT" => Some("tether"),
        "DAI" => Some("dai"),
        "SOL" | "WSOL" => Some("solana"),
        "BNB" | "WBNB" => Some("binancecoin"),
        "MATIC" | "POL" => Some("matic-network"),
        "ARB" => Some("arbitrum"),
        "OP" => Some("optimism"),
        "LINK" => Some("chainlink"),
        "UNI" => Some("uniswap"),
        "AAVE" => Some("aave"),
        "MKR" => Some("maker"),
        "CRV" => Some("curve-dao-token"),
        "LDO" => Some("lido-dao"),
        "RPL" => Some("rocket-pool"),
        "SUSHI" => Some("sushi"),
        "COMP" => Some("compound-governance-token"),
        "SNX" => Some("synthetix-network-token"),
        "YFI" => Some("yearn-finance"),
        "BAL" => Some("balancer"),
        "1INCH" => Some("1inch"),
        "GRT" => Some("the-graph"),
        "ENS" => Some("ethereum-name-service"),
        "DYDX" => Some("dydx"),
        "GMX" => Some("gmx"),
        "PENDLE" => Some("pendle"),
        "JTO" => Some("jito-governance-token"),
        "JUP" => Some("jupiter-exchange-solana"),
        "PYTH" => Some("pyth-network"),
        "RAY" => Some("raydium"),
        "MNDE" => Some("marinade"),
        "ORCA" => Some("orca"),
        "BONK" => Some("bonk"),
        "WIF" => Some("dogwifcoin"),
        "RENDER" => Some("render-token"),
        "STETH" => Some("staked-ether"),
        "RETH" => Some("rocket-pool-eth"),
        "CBETH" => Some("coinbase-wrapped-staked-eth"),
        "FRAX" => Some("frax"),
        "LUSD" => Some("liquity-usd"),
        "SUSD" => Some("susd"),
        "SFRXETH" => Some("staked-frax-ether"),
        "WEETH" => Some("wrapped-eeth"),
        "EZETH" => Some("renzo-restaked-eth"),
        "RSETH" => Some("kelp-dao-restaked-eth"),
        _ => None,
    }
}

pub fn chain_to_coingecko_platform(chain: &str) -> Option<&'static str> {
    match chain.to_lowercase().as_str() {
        "ethereum" => Some("ethereum"),
        "base" => Some("base"),
        "arbitrum" => Some("arbitrum-one"),
        "bnb" => Some("binance-smart-chain"),
        "solana" => Some("solana"),
        "polygon" => Some("polygon-pos"),
        "optimism" => Some("optimistic-ethereum"),
        "avalanche" => Some("avalanche"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_symbol_mapping() {
        assert_eq!(symbol_to_coingecko_id("ETH"), Some("ethereum"));
        assert_eq!(symbol_to_coingecko_id("weth"), Some("ethereum"));
        assert_eq!(symbol_to_coingecko_id("USDC"), Some("usd-coin"));
        assert_eq!(symbol_to_coingecko_id("BTC"), Some("bitcoin"));
        assert_eq!(symbol_to_coingecko_id("UNKNOWN"), None);
    }

    #[test]
    fn test_chain_mapping() {
        assert_eq!(chain_to_coingecko_platform("ethereum"), Some("ethereum"));
        assert_eq!(chain_to_coingecko_platform("BASE"), Some("base"));
        assert_eq!(chain_to_coingecko_platform("unknown"), None);
    }
}
