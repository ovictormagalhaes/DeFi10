use super::models::*;
use crate::types::{PositionToken, PositionType, ProtocolPosition};
use defi10_blockchain::BlockchainProvider;
use defi10_core::{http_helpers::check_and_parse, Chain, DeFi10Error, Protocol, Result};
use num_bigint::BigUint;
use num_traits::{One, Zero};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone, Default)]
pub struct UniswapGraphConfig {
    pub api_key: Option<String>,
    pub url_template: Option<String>,
    pub ethereum_subgraph_id: Option<String>,
    pub base_subgraph_id: Option<String>,
    pub arbitrum_subgraph_id: Option<String>,
    pub ethereum_rpc: Option<String>,
    pub base_rpc: Option<String>,
    pub arbitrum_rpc: Option<String>,
}

const POSITION_MANAGER_ADDRESSES: &[(&str, &str)] = &[
    ("ethereum", "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"),
    ("arbitrum", "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"),
    ("base", "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"),
];

pub struct UniswapV3Service {
    client: Arc<Client>,
    pub subgraph_urls: HashMap<Chain, String>,
    position_managers: HashMap<Chain, String>,
    rpc_urls: HashMap<Chain, String>,
}

impl UniswapV3Service {
    pub fn new() -> Self {
        Self::with_config(UniswapGraphConfig::default())
    }

    pub fn with_config(config: UniswapGraphConfig) -> Self {
        let mut subgraph_urls = HashMap::new();
        let mut position_managers = HashMap::new();

        let has_api_key = config
            .api_key
            .as_ref()
            .map(|k| !k.is_empty())
            .unwrap_or(false);
        let url_template = config
            .url_template
            .as_deref()
            .unwrap_or("https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}");

        if has_api_key {
            let api_key = config.api_key.as_ref().unwrap();

            if let Some(ref id) = config.ethereum_subgraph_id {
                if !id.is_empty() {
                    let url = url_template
                        .replace("{API_KEY}", api_key)
                        .replace("{ID}", id);
                    subgraph_urls.insert(Chain::Ethereum, url);
                    tracing::info!("Uniswap Ethereum subgraph configured via The Graph gateway");
                }
            }

            if let Some(ref id) = config.base_subgraph_id {
                if !id.is_empty() {
                    let url = url_template
                        .replace("{API_KEY}", api_key)
                        .replace("{ID}", id);
                    subgraph_urls.insert(Chain::Base, url);
                    tracing::info!("Uniswap Base subgraph configured via The Graph gateway");
                }
            }

            if let Some(ref id) = config.arbitrum_subgraph_id {
                if !id.is_empty() {
                    let url = url_template
                        .replace("{API_KEY}", api_key)
                        .replace("{ID}", id);
                    subgraph_urls.insert(Chain::Arbitrum, url);
                    tracing::info!("Uniswap Arbitrum subgraph configured via The Graph gateway");
                }
            }
        }

        if subgraph_urls.is_empty() {
            tracing::warn!("No Uniswap subgraph URLs configured - Graph API key may be missing");
        }

        for (chain_name, address) in POSITION_MANAGER_ADDRESSES {
            if let Ok(chain) = chain_name.parse::<Chain>() {
                position_managers.insert(chain, address.to_string());
            }
        }

        let mut rpc_urls = HashMap::new();
        if let Some(ref url) = config.ethereum_rpc {
            if !url.is_empty() {
                rpc_urls.insert(Chain::Ethereum, url.clone());
            }
        }
        if let Some(ref url) = config.base_rpc {
            if !url.is_empty() {
                rpc_urls.insert(Chain::Base, url.clone());
            }
        }
        if let Some(ref url) = config.arbitrum_rpc {
            if !url.is_empty() {
                rpc_urls.insert(Chain::Arbitrum, url.clone());
            }
        }

        Self {
            client: Arc::new(Client::new()),
            subgraph_urls,
            position_managers,
            rpc_urls,
        }
    }

    pub fn with_client(client: Arc<Client>, config: UniswapGraphConfig) -> Self {
        let mut svc = Self::with_config(config);
        svc.client = client;
        svc
    }

    pub fn is_chain_supported(&self, chain: Chain) -> bool {
        self.subgraph_urls.contains_key(&chain)
    }

    async fn fetch_tick_fee_growth(
        &self,
        chain: Chain,
        pool_address: &str,
        tick: i32,
    ) -> Option<(BigUint, BigUint)> {
        let rpc_url = self.rpc_urls.get(&chain)?;

        let tick_bytes = (tick as i32).to_be_bytes();
        let pad_byte = if tick < 0 { "ff" } else { "00" };
        let tick_hex = format!("{}{}", pad_byte.repeat(28), hex::encode(tick_bytes));
        let calldata = format!("0xf30dba93{}", tick_hex);

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{
                "to": pool_address,
                "data": calldata,
            }, "latest"],
            "id": 1
        });

        let response = self.client.post(rpc_url).json(&body).send().await.ok()?;
        let json: serde_json::Value = response.json().await.ok()?;
        let result = json.get("result")?.as_str()?;

        if result.len() < 2 + 256 {
            return None;
        }

        let data = &result[2..];
        let fg0_hex = &data[128..192];
        let fg1_hex = &data[192..256];

        let fg0 = BigUint::parse_bytes(fg0_hex.as_bytes(), 16).unwrap_or_default();
        let fg1 = BigUint::parse_bytes(fg1_hex.as_bytes(), 16).unwrap_or_default();

        Some((fg0, fg1))
    }

    /// Get user positions from Uniswap V3
    pub async fn get_user_positions(
        &self,
        chain: Chain,
        user_address: &str,
        provider: Arc<dyn BlockchainProvider>,
    ) -> Result<Vec<ProtocolPosition>> {
        let subgraph_url = self
            .subgraph_urls
            .get(&chain)
            .ok_or_else(|| DeFi10Error::ChainNotSupported(chain))?;

        let positions = self
            .fetch_user_positions(subgraph_url, user_address)
            .await?;

        let mut protocol_positions = Vec::new();

        for position in positions {
            let protocol_position = self
                .parse_position(chain, user_address, position, provider.clone())
                .await?;

            protocol_positions.push(protocol_position);
        }

        Ok(protocol_positions)
    }

    /// Fetch positions from subgraph
    async fn fetch_user_positions(
        &self,
        subgraph_url: &str,
        user_address: &str,
    ) -> Result<Vec<Position>> {
        let query = format!(
            r#"{{
                positions(
                    where: {{
                        owner: "{}"
                        liquidity_gt: "0"
                    }}
                    first: 100
                ) {{
                    id
                    owner
                    liquidity
                    depositedToken0
                    depositedToken1
                    withdrawnToken0
                    withdrawnToken1
                    collectedFeesToken0
                    collectedFeesToken1
                    feeGrowthInside0LastX128
                    feeGrowthInside1LastX128
                    pool {{
                        id
                        feeTier
                        token0 {{
                            id
                            symbol
                            decimals
                        }}
                        token1 {{
                            id
                            symbol
                            decimals
                        }}
                        tick
                        sqrtPrice
                        liquidity
                        feeGrowthGlobal0X128
                        feeGrowthGlobal1X128
                    }}
                    tickLower {{
                        tickIdx
                        feeGrowthOutside0X128
                        feeGrowthOutside1X128
                    }}
                    tickUpper {{
                        tickIdx
                        feeGrowthOutside0X128
                        feeGrowthOutside1X128
                    }}
                    transaction {{
                        timestamp
                    }}
                }}
            }}"#,
            user_address.to_lowercase()
        );

        let body = serde_json::json!({
            "query": query
        });

        let response = self
            .client
            .post(subgraph_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        let result: UniswapPositionsResponse =
            check_and_parse(response, "Uniswap subgraph").await?;

        Ok(result.data.map(|d| d.positions).unwrap_or_default())
    }

    async fn parse_position(
        &self,
        chain: Chain,
        user_address: &str,
        position: Position,
        _provider: Arc<dyn BlockchainProvider>,
    ) -> Result<ProtocolPosition> {
        let pool = &position.pool;

        let decimals0 = pool
            .token0
            .decimals
            .parse::<u8>()
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;
        let decimals1 = pool
            .token1
            .decimals
            .parse::<u8>()
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;

        let deposited0: f64 = position.deposited_token0.parse().unwrap_or(0.0);
        let withdrawn0: f64 = position.withdrawn_token0.parse().unwrap_or(0.0);
        let deposited1: f64 = position.deposited_token1.parse().unwrap_or(0.0);
        let withdrawn1: f64 = position.withdrawn_token1.parse().unwrap_or(0.0);
        let current_supply0 = (deposited0 - withdrawn0).max(0.0);
        let current_supply1 = (deposited1 - withdrawn1).max(0.0);

        let collected_fees0: f64 = position.collected_fees_token0.parse().unwrap_or(0.0);
        let collected_fees1: f64 = position.collected_fees_token1.parse().unwrap_or(0.0);

        let tick_lower = position
            .tick_lower
            .as_string()
            .parse::<i32>()
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;
        let tick_upper = position
            .tick_upper
            .as_string()
            .parse::<i32>()
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;
        let current_tick = pool.tick.as_deref().and_then(|t| t.parse::<i32>().ok());
        let in_range = current_tick
            .map(|ct| ct >= tick_lower && ct < tick_upper)
            .unwrap_or(false);

        let fee_tier: f64 = pool.fee_tier.parse().unwrap_or(0.0);
        let tier_percent = fee_tier / 1_000_000.0;

        let decimals_diff = decimals0 as f64 - decimals1 as f64;
        let lower_price = 1.0001_f64.powi(tick_lower) * 10_f64.powf(decimals_diff);
        let upper_price = 1.0001_f64.powi(tick_upper) * 10_f64.powf(decimals_diff);
        let current_price = current_tick.map(|ct| 1.0001_f64.powi(ct) * 10_f64.powf(decimals_diff));
        let range_size = if lower_price > 0.0 {
            (upper_price - lower_price) / lower_price
        } else {
            0.0
        };

        let supplied0 = PositionToken {
            token_address: pool.token0.id.clone(),
            symbol: pool.token0.symbol.clone(),
            name: pool.token0.symbol.clone(),
            decimals: decimals0,
            balance: format!("{}", current_supply0),
            balance_usd: 0.0,
            price_usd: 0.0,
            token_type: Some("Supplied".to_string()),
        };
        let supplied1 = PositionToken {
            token_address: pool.token1.id.clone(),
            symbol: pool.token1.symbol.clone(),
            name: pool.token1.symbol.clone(),
            decimals: decimals1,
            balance: format!("{}", current_supply1),
            balance_usd: 0.0,
            price_usd: 0.0,
            token_type: Some("Supplied".to_string()),
        };

        let (uncollected_fees0, uncollected_fees1) = {
            let lower_tick_fg = self
                .fetch_tick_fee_growth(chain, &pool.id, tick_lower)
                .await;
            let upper_tick_fg = self
                .fetch_tick_fee_growth(chain, &pool.id, tick_upper)
                .await;

            let lower0 = lower_tick_fg.as_ref().map(|(fg0, _)| fg0.to_string());
            let lower1 = lower_tick_fg.as_ref().map(|(_, fg1)| fg1.to_string());
            let upper0 = upper_tick_fg.as_ref().map(|(fg0, _)| fg0.to_string());
            let upper1 = upper_tick_fg.as_ref().map(|(_, fg1)| fg1.to_string());

            calculate_uncollected_fees(
                &position.liquidity,
                current_tick.unwrap_or(0),
                tick_lower,
                tick_upper,
                pool.fee_growth_global0_x128.as_deref(),
                pool.fee_growth_global1_x128.as_deref(),
                lower0
                    .as_deref()
                    .or(position.tick_lower.fee_growth_outside0()),
                lower1
                    .as_deref()
                    .or(position.tick_lower.fee_growth_outside1()),
                upper0
                    .as_deref()
                    .or(position.tick_upper.fee_growth_outside0()),
                upper1
                    .as_deref()
                    .or(position.tick_upper.fee_growth_outside1()),
                position.fee_growth_inside0_last_x128.as_deref(),
                position.fee_growth_inside1_last_x128.as_deref(),
                decimals0,
                decimals1,
            )
        };

        let uncollected0 = PositionToken {
            token_address: pool.token0.id.clone(),
            symbol: pool.token0.symbol.clone(),
            name: pool.token0.symbol.clone(),
            decimals: decimals0,
            balance: uncollected_fees0,
            balance_usd: 0.0,
            price_usd: 0.0,
            token_type: Some("LiquidityUncollectedFee".to_string()),
        };
        let uncollected1 = PositionToken {
            token_address: pool.token1.id.clone(),
            symbol: pool.token1.symbol.clone(),
            name: pool.token1.symbol.clone(),
            decimals: decimals1,
            balance: uncollected_fees1,
            balance_usd: 0.0,
            price_usd: 0.0,
            token_type: Some("LiquidityUncollectedFee".to_string()),
        };

        let collected0 = PositionToken {
            token_address: pool.token0.id.clone(),
            symbol: pool.token0.symbol.clone(),
            name: pool.token0.symbol.clone(),
            decimals: decimals0,
            balance: format!("{}", collected_fees0),
            balance_usd: 0.0,
            price_usd: 0.0,
            token_type: Some("LiquidityCollectedFee".to_string()),
        };
        let collected1 = PositionToken {
            token_address: pool.token1.id.clone(),
            symbol: pool.token1.symbol.clone(),
            name: pool.token1.symbol.clone(),
            decimals: decimals1,
            balance: format!("{}", collected_fees1),
            balance_usd: 0.0,
            price_usd: 0.0,
            token_type: Some("LiquidityCollectedFee".to_string()),
        };

        let tokens = vec![
            supplied0,
            supplied1,
            uncollected0,
            uncollected1,
            collected0,
            collected1,
        ];

        let created_at = position
            .transaction
            .as_ref()
            .and_then(|t| t.timestamp.parse::<i64>().ok());

        let metadata = serde_json::json!({
            "poolId": pool.id,
            "sqrtPriceX96": pool.sqrt_price,
            "feeTier": pool.fee_tier,
            "tierPercent": tier_percent,
            "liquidity": position.liquidity,
            "createdAt": created_at,
            "range": {
                "lower": lower_price,
                "upper": upper_price,
                "current": current_price,
                "inRange": in_range,
                "rangeSize": range_size,
            },
        });

        Ok(ProtocolPosition {
            protocol: Protocol::UniswapV3,
            chain,
            wallet_address: user_address.to_string(),
            position_type: PositionType::LiquidityPool,
            tokens,
            total_value_usd: 0.0,
            metadata,
        })
    }

    /// Check if position is in range
    fn is_in_range(current_tick: Option<&str>, tick_lower: i32, tick_upper: i32) -> bool {
        if let Some(tick_str) = current_tick {
            if let Ok(tick) = tick_str.parse::<i32>() {
                return tick >= tick_lower && tick <= tick_upper;
            }
        }
        false
    }

    /// Calculate fees earned for a position
    pub fn calculate_fees_earned(&self, position: &Position) -> Result<(String, String)> {
        let fees0 = position.collected_fees_token0.clone();
        let fees1 = position.collected_fees_token1.clone();

        Ok((fees0, fees1))
    }

    /// Get pool information
    pub async fn get_pool_info(&self, chain: Chain, pool_address: &str) -> Result<PoolInfo> {
        let subgraph_url = self
            .subgraph_urls
            .get(&chain)
            .ok_or_else(|| DeFi10Error::ChainNotSupported(chain))?;

        let query = format!(
            r#"{{
                pool(id: "{}") {{
                    id
                    token0 {{
                        id
                        symbol
                    }}
                    token1 {{
                        id
                        symbol
                    }}
                    feeTier
                    tick
                    sqrtPrice
                    liquidity
                }}
            }}"#,
            pool_address.to_lowercase()
        );

        let body = serde_json::json!({
            "query": query
        });

        let response = self
            .client
            .post(subgraph_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        #[derive(Deserialize)]
        struct PoolResponse {
            data: Option<PoolData>,
        }

        #[derive(Deserialize)]
        struct PoolData {
            pool: Option<Pool>,
        }

        let result: PoolResponse = response
            .json()
            .await
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;

        let pool = result
            .data
            .and_then(|d| d.pool)
            .ok_or_else(|| DeFi10Error::NotFound(format!("Pool not found: {}", pool_address)))?;

        Ok(PoolInfo {
            address: pool.id.clone(),
            token0: pool.token0.id.clone(),
            token1: pool.token1.id.clone(),
            fee: pool
                .fee_tier
                .parse()
                .map_err(|e| DeFi10Error::ParseError(format!("Invalid fee tier: {}", e)))?,
            tick: pool.tick.as_ref().and_then(|t| t.parse().ok()).unwrap_or(0),
            sqrt_price_x96: pool.sqrt_price.clone(),
            liquidity: pool.liquidity.clone(),
        })
    }
}

fn parse_biguint(s: Option<&str>) -> BigUint {
    s.and_then(|v| v.parse::<BigUint>().ok())
        .unwrap_or_else(BigUint::zero)
}

fn format_biguint_with_decimals(value: &BigUint, decimals: u8) -> String {
    if value.is_zero() {
        return "0".to_string();
    }
    let divisor = BigUint::from(10u64).pow(decimals as u32);
    let integer_part = value / &divisor;
    let remainder = value % &divisor;
    if remainder.is_zero() {
        return integer_part.to_string();
    }
    let remainder_str = format!("{:0>width$}", remainder, width = decimals as usize);
    let trimmed = remainder_str.trim_end_matches('0');
    format!("{}.{}", integer_part, trimmed)
}

fn subtract_uint256(a: &BigUint, b: &BigUint) -> BigUint {
    if a >= b {
        a - b
    } else {
        let max_uint256 = (BigUint::one() << 256) - BigUint::one();
        &max_uint256 - b + a + BigUint::one()
    }
}

fn calculate_fee_growth_inside(
    current_tick: i32,
    tick_lower: i32,
    tick_upper: i32,
    fee_growth_global: &BigUint,
    fee_growth_outside_lower: &BigUint,
    fee_growth_outside_upper: &BigUint,
) -> BigUint {
    let fee_growth_below = if current_tick >= tick_lower {
        fee_growth_outside_lower.clone()
    } else {
        subtract_uint256(fee_growth_global, fee_growth_outside_lower)
    };

    let fee_growth_above = if current_tick < tick_upper {
        fee_growth_outside_upper.clone()
    } else {
        subtract_uint256(fee_growth_global, fee_growth_outside_upper)
    };

    subtract_uint256(
        &subtract_uint256(fee_growth_global, &fee_growth_below),
        &fee_growth_above,
    )
}

fn calculate_uncollected_fees(
    liquidity_str: &str,
    current_tick: i32,
    tick_lower: i32,
    tick_upper: i32,
    fee_growth_global0: Option<&str>,
    fee_growth_global1: Option<&str>,
    fee_growth_outside_lower0: Option<&str>,
    fee_growth_outside_lower1: Option<&str>,
    fee_growth_outside_upper0: Option<&str>,
    fee_growth_outside_upper1: Option<&str>,
    fee_growth_inside0_last: Option<&str>,
    fee_growth_inside1_last: Option<&str>,
    decimals0: u8,
    decimals1: u8,
) -> (String, String) {
    let liquidity = parse_biguint(Some(liquidity_str));
    if liquidity.is_zero() {
        return ("0".to_string(), "0".to_string());
    }

    let has_data = fee_growth_global0.is_some()
        && fee_growth_inside0_last.is_some()
        && fee_growth_outside_lower0.is_some()
        && fee_growth_outside_upper0.is_some();

    if !has_data {
        return ("0".to_string(), "0".to_string());
    }

    let q128 = BigUint::one() << 128;

    let fg_global0 = parse_biguint(fee_growth_global0);
    let fg_global1 = parse_biguint(fee_growth_global1);
    let fg_outside_lower0 = parse_biguint(fee_growth_outside_lower0);
    let fg_outside_lower1 = parse_biguint(fee_growth_outside_lower1);
    let fg_outside_upper0 = parse_biguint(fee_growth_outside_upper0);
    let fg_outside_upper1 = parse_biguint(fee_growth_outside_upper1);
    let fg_inside0_last = parse_biguint(fee_growth_inside0_last);
    let fg_inside1_last = parse_biguint(fee_growth_inside1_last);

    let fg_inside0 = calculate_fee_growth_inside(
        current_tick,
        tick_lower,
        tick_upper,
        &fg_global0,
        &fg_outside_lower0,
        &fg_outside_upper0,
    );
    let fg_inside1 = calculate_fee_growth_inside(
        current_tick,
        tick_lower,
        tick_upper,
        &fg_global1,
        &fg_outside_lower1,
        &fg_outside_upper1,
    );

    let delta0 = subtract_uint256(&fg_inside0, &fg_inside0_last);
    let delta1 = subtract_uint256(&fg_inside1, &fg_inside1_last);

    let fees0_raw: BigUint = (&liquidity * &delta0) / &q128;
    let fees1_raw: BigUint = (&liquidity * &delta1) / &q128;

    let fees0_str = format_biguint_with_decimals(&fees0_raw, decimals0);
    let fees1_str = format_biguint_with_decimals(&fees1_raw, decimals1);

    (fees0_str, fees1_str)
}

impl Default for UniswapV3Service {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let config = UniswapGraphConfig {
            api_key: Some("test_key".to_string()),
            url_template: None,
            ethereum_subgraph_id: Some("eth_id".to_string()),
            base_subgraph_id: None,
            arbitrum_subgraph_id: None,
        };
        let service = UniswapV3Service::with_config(config);
        assert!(service.subgraph_urls.contains_key(&Chain::Ethereum));
        assert!(service.position_managers.contains_key(&Chain::Ethereum));
    }

    #[test]
    fn test_is_in_range() {
        // In range
        assert!(UniswapV3Service::is_in_range(Some("0"), -100, 100));
        assert!(UniswapV3Service::is_in_range(Some("50"), -100, 100));

        // Out of range
        assert!(!UniswapV3Service::is_in_range(Some("200"), -100, 100));
        assert!(!UniswapV3Service::is_in_range(Some("-200"), -100, 100));

        // Invalid tick
        assert!(!UniswapV3Service::is_in_range(Some("invalid"), -100, 100));
        assert!(!UniswapV3Service::is_in_range(None, -100, 100));
    }

    #[test]
    fn test_calculate_fees() {
        let service = UniswapV3Service::new();

        let position = Position {
            id: "1".to_string(),
            owner: "0xOwner".to_string(),
            liquidity: "1000000".to_string(),
            deposited_token0: "100".to_string(),
            deposited_token1: "200".to_string(),
            withdrawn_token0: "0".to_string(),
            withdrawn_token1: "0".to_string(),
            collected_fees_token0: "10".to_string(),
            collected_fees_token1: "20".to_string(),
            fee_growth_inside0_last_x128: None,
            fee_growth_inside1_last_x128: None,
            pool: Pool {
                id: "0xPool".to_string(),
                fee_tier: "3000".to_string(),
                token0: Token {
                    id: "0xToken0".to_string(),
                    symbol: "USDC".to_string(),
                    decimals: "6".to_string(),
                },
                token1: Token {
                    id: "0xToken1".to_string(),
                    symbol: "WETH".to_string(),
                    decimals: "18".to_string(),
                },
                tick: Some("100".to_string()),
                sqrt_price: "1000000".to_string(),
                liquidity: "500000".to_string(),
                fee_growth_global0_x128: None,
                fee_growth_global1_x128: None,
            },
            tick_lower: TickValue::Object(TickData {
                tick_idx: "-100".to_string(),
                fee_growth_outside0_x128: None,
                fee_growth_outside1_x128: None,
            }),
            tick_upper: TickValue::Object(TickData {
                tick_idx: "100".to_string(),
                fee_growth_outside0_x128: None,
                fee_growth_outside1_x128: None,
            }),
            transaction: None,
        };

        let (fees0, fees1) = service.calculate_fees_earned(&position).unwrap();
        assert_eq!(fees0, "10");
        assert_eq!(fees1, "20");
    }

    #[tokio::test]
    async fn test_unsupported_chain() {
        let service = UniswapV3Service::new();
        let provider = Arc::new(
            defi10_blockchain::evm::EvmProvider::new(Chain::Ethereum, "https://eth.llamarpc.com")
                .await
                .unwrap(),
        );

        let result = service
            .get_user_positions(Chain::Solana, "0x123", provider)
            .await;

        assert!(result.is_err());
    }

    #[test]
    fn test_is_in_range_edge_cases() {
        assert!(UniswapV3Service::is_in_range(Some("-100"), -100, 100));
        assert!(UniswapV3Service::is_in_range(Some("100"), -100, 100));
        assert!(!UniswapV3Service::is_in_range(Some("-101"), -100, 100));
        assert!(!UniswapV3Service::is_in_range(Some("101"), -100, 100));
    }

    #[test]
    fn test_calculate_fees_zero() {
        let service = UniswapV3Service::new();

        let position = Position {
            id: "1".to_string(),
            owner: "0xOwner".to_string(),
            liquidity: "1000000".to_string(),
            deposited_token0: "100".to_string(),
            deposited_token1: "200".to_string(),
            withdrawn_token0: "0".to_string(),
            withdrawn_token1: "0".to_string(),
            collected_fees_token0: "0".to_string(),
            collected_fees_token1: "0".to_string(),
            fee_growth_inside0_last_x128: None,
            fee_growth_inside1_last_x128: None,
            pool: Pool {
                id: "0xPool".to_string(),
                fee_tier: "3000".to_string(),
                token0: Token {
                    id: "0xT0".to_string(),
                    symbol: "USDC".to_string(),
                    decimals: "6".to_string(),
                },
                token1: Token {
                    id: "0xT1".to_string(),
                    symbol: "WETH".to_string(),
                    decimals: "18".to_string(),
                },
                tick: Some("100".to_string()),
                sqrt_price: "1000000".to_string(),
                liquidity: "500000".to_string(),
                fee_growth_global0_x128: None,
                fee_growth_global1_x128: None,
            },
            tick_lower: TickValue::Object(TickData {
                tick_idx: "-100".to_string(),
                fee_growth_outside0_x128: None,
                fee_growth_outside1_x128: None,
            }),
            tick_upper: TickValue::Object(TickData {
                tick_idx: "100".to_string(),
                fee_growth_outside0_x128: None,
                fee_growth_outside1_x128: None,
            }),
            transaction: None,
        };

        let (fees0, fees1) = service.calculate_fees_earned(&position).unwrap();
        assert_eq!(fees0, "0");
        assert_eq!(fees1, "0");
    }

    #[test]
    fn test_service_default() {
        let service1 = UniswapV3Service::new();
        let service2 = UniswapV3Service::default();
        assert_eq!(service1.subgraph_urls.len(), service2.subgraph_urls.len());
    }

    #[test]
    fn test_position_manager_addresses() {
        let service = UniswapV3Service::new();
        assert!(service.position_managers.contains_key(&Chain::Ethereum));
        assert!(service.position_managers.contains_key(&Chain::Arbitrum));
        assert!(service.position_managers.contains_key(&Chain::Base));
    }
}
