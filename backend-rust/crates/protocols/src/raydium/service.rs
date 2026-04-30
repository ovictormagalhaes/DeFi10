use super::position_store::{RaydiumPositionState, RaydiumPositionStore};
use crate::types::{PositionToken, PositionType, ProtocolPosition};
use chrono::Utc;
use defi10_core::{Chain, DeFi10Error, Protocol, Result};
use reqwest::Client;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;
use tokio::time::{sleep, Duration};

const RAYDIUM_API_V3: &str = "https://api-v3.raydium.io";
const CLMM_PROGRAM_ID: &str = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
const RPC_DELAY_MS: u64 = 300;
const MAX_RETRIES: u32 = 3;

pub struct RaydiumService {
    client: Arc<Client>,
    rpc_url: String,
    position_store: Option<Arc<dyn RaydiumPositionStore>>,
}

impl RaydiumService {
    pub fn new() -> Self {
        Self::with_rpc_url("https://api.mainnet-beta.solana.com".to_string())
    }

    pub fn with_rpc_url(rpc_url: String) -> Self {
        Self {
            client: Arc::new(Client::new()),
            rpc_url,
            position_store: None,
        }
    }

    pub fn with_client(client: Arc<Client>, rpc_url: String) -> Self {
        Self {
            client,
            rpc_url,
            position_store: None,
        }
    }

    pub fn with_store(
        client: Arc<Client>,
        rpc_url: String,
        store: Arc<dyn RaydiumPositionStore>,
    ) -> Self {
        Self {
            client,
            rpc_url,
            position_store: Some(store),
        }
    }

    pub async fn get_user_positions(
        &self,
        wallet_address: &str,
        provider: Arc<defi10_blockchain::SolanaProvider>,
    ) -> Result<Vec<ProtocolPosition>> {
        tracing::info!(
            "[Raydium] Starting position fetch for wallet: {}",
            wallet_address
        );

        let _pubkey = Pubkey::from_str(wallet_address)
            .map_err(|e| DeFi10Error::Validation(format!("Invalid Solana address: {}", e)))?;

        let nft_mints = provider.get_nft_positions(wallet_address)?;
        tracing::info!(
            "[Raydium] Found {} potential NFT mints for {}",
            nft_mints.len(),
            wallet_address
        );

        if nft_mints.is_empty() {
            tracing::debug!("[Raydium] No NFT mints found, returning empty positions");
            return Ok(vec![]);
        }

        let mut position_pdas = Vec::new();
        for nft_mint in &nft_mints {
            if let Ok(pda) = self.derive_position_pda(nft_mint) {
                position_pdas.push((nft_mint.clone(), pda));
            }
        }

        tracing::info!(
            "[Raydium] Derived {} position PDAs from NFTs",
            position_pdas.len()
        );

        if position_pdas.is_empty() {
            return Ok(vec![]);
        }

        let mut positions = Vec::new();
        for (_nft_mint, pda) in &position_pdas {
            match self
                .fetch_and_parse_position(pda, wallet_address, &provider)
                .await
            {
                Ok(Some(pos)) => {
                    tracing::info!("[Raydium] Successfully parsed position for PDA: {}", pda);
                    positions.push(pos);
                }
                Ok(None) => {
                    tracing::debug!(
                        "[Raydium] Position PDA {} has no liquidity or invalid data",
                        pda
                    );
                }
                Err(e) => {
                    tracing::warn!("[Raydium] Failed to parse position PDA {}: {}", pda, e);
                }
            }
        }

        tracing::info!(
            "[Raydium] Returning {} positions for {}",
            positions.len(),
            wallet_address
        );
        Ok(positions)
    }

    fn derive_position_pda(&self, nft_mint: &str) -> Result<String> {
        let nft_pubkey = Pubkey::from_str(nft_mint)
            .map_err(|e| DeFi10Error::Validation(format!("Invalid NFT mint: {}", e)))?;

        let program_id = Pubkey::from_str(CLMM_PROGRAM_ID)
            .map_err(|e| DeFi10Error::Internal(format!("Invalid program ID: {}", e)))?;

        let seeds: &[&[u8]] = &[b"position", nft_pubkey.as_ref()];

        let (pda, _bump) = Pubkey::find_program_address(seeds, &program_id);
        Ok(pda.to_string())
    }

    async fn fetch_and_parse_position(
        &self,
        position_pda: &str,
        wallet_address: &str,
        _provider: &Arc<defi10_blockchain::SolanaProvider>,
    ) -> Result<Option<ProtocolPosition>> {
        let position_data = self.fetch_account_data(position_pda).await?;

        if position_data.is_empty() || position_data.len() < 217 {
            return Ok(None);
        }

        let position = ClmmPosition::parse(&position_data)?;

        if position.liquidity == 0 {
            return Ok(None);
        }

        let pool_data = self.fetch_account_data(&position.pool_id).await?;
        if pool_data.is_empty() || pool_data.len() < 300 {
            return Ok(None);
        }

        let pool = ClmmPool::parse(&pool_data, &position.pool_id)?;

        let (amount_a, amount_b) = self.calculate_amounts(&position, &pool);
        let (fees_a, fees_b) = self
            .calculate_uncollected_fees_with_ticks(&position, &pool)
            .await;

        let token_a_decimals = self
            .get_token_decimals(&pool.token_mint_a)
            .await
            .unwrap_or(9);
        let token_b_decimals = self
            .get_token_decimals(&pool.token_mint_b)
            .await
            .unwrap_or(6);

        let token_a_balance = amount_a as f64 / 10f64.powi(token_a_decimals as i32);
        let token_b_balance = amount_b as f64 / 10f64.powi(token_b_decimals as i32);
        let fees_a_balance = fees_a as f64 / 10f64.powi(token_a_decimals as i32);
        let fees_b_balance = fees_b as f64 / 10f64.powi(token_b_decimals as i32);

        let (token_a_price, token_b_price) = self
            .fetch_token_prices(&pool.token_mint_a, &pool.token_mint_b)
            .await;

        let collected = self
            .resolve_collected_fees(
                &position,
                position_pda,
                wallet_address,
                &pool.token_mint_a,
                &pool.token_mint_b,
                fees_a,
                fees_b,
                token_a_price,
                token_b_price,
            )
            .await;

        let value_a = token_a_balance * token_a_price;
        let value_b = token_b_balance * token_b_price;
        let fees_value_a = fees_a_balance * token_a_price;
        let fees_value_b = fees_b_balance * token_b_price;
        let total_value = value_a + value_b + fees_value_a + fees_value_b + collected.value_usd;

        let symbol_a = self.get_token_symbol(&pool.token_mint_a).await;
        let symbol_b = self.get_token_symbol(&pool.token_mint_b).await;

        let mut tokens = vec![
            PositionToken {
                token_address: pool.token_mint_a.clone(),
                symbol: symbol_a.clone(),
                name: symbol_a.clone(),
                decimals: token_a_decimals,
                balance: token_a_balance.to_string(),
                balance_usd: value_a,
                price_usd: token_a_price,
                token_type: Some("Supplied".to_string()),
            },
            PositionToken {
                token_address: pool.token_mint_b.clone(),
                symbol: symbol_b.clone(),
                name: symbol_b.clone(),
                decimals: token_b_decimals,
                balance: token_b_balance.to_string(),
                balance_usd: value_b,
                price_usd: token_b_price,
                token_type: Some("Supplied".to_string()),
            },
        ];

        if fees_a > 0 || fees_a_balance > 0.0 {
            tokens.push(PositionToken {
                token_address: pool.token_mint_a.clone(),
                symbol: symbol_a.clone(),
                name: symbol_a.clone(),
                decimals: token_a_decimals,
                balance: fees_a_balance.to_string(),
                balance_usd: fees_value_a,
                price_usd: token_a_price,
                token_type: Some("LiquidityUncollectedFee".to_string()),
            });
        }

        if fees_b > 0 || fees_b_balance > 0.0 {
            tokens.push(PositionToken {
                token_address: pool.token_mint_b.clone(),
                symbol: symbol_b.clone(),
                name: symbol_b.clone(),
                decimals: token_b_decimals,
                balance: fees_b_balance.to_string(),
                balance_usd: fees_value_b,
                price_usd: token_b_price,
                token_type: Some("LiquidityUncollectedFee".to_string()),
            });
        }

        if collected.accumulated_a > 0.0 {
            tokens.push(PositionToken {
                token_address: pool.token_mint_a.clone(),
                symbol: symbol_a.clone(),
                name: symbol_a.clone(),
                decimals: token_a_decimals,
                balance: collected.accumulated_a.to_string(),
                balance_usd: collected.accumulated_a * token_a_price,
                price_usd: token_a_price,
                token_type: Some("LiquidityCollectedFee".to_string()),
            });
        }

        if collected.accumulated_b > 0.0 {
            tokens.push(PositionToken {
                token_address: pool.token_mint_b.clone(),
                symbol: symbol_b.clone(),
                name: symbol_b.clone(),
                decimals: token_b_decimals,
                balance: collected.accumulated_b.to_string(),
                balance_usd: collected.accumulated_b * token_b_price,
                price_usd: token_b_price,
                token_type: Some("LiquidityCollectedFee".to_string()),
            });
        }

        let range_info =
            self.build_range_info(&position, &pool, token_a_decimals, token_b_decimals);
        let in_range =
            pool.tick_current >= position.tick_lower && pool.tick_current < position.tick_upper;

        let tier_percent = self.tick_spacing_to_fee_tier(pool.tick_spacing);

        let created_at = self.fetch_nft_mint_timestamp(&position.nft_mint).await;

        let total_fees = fees_value_a + fees_value_b + collected.value_usd;
        let principal = total_value - total_fees;
        let days_active = if let Some(timestamp) = created_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let diff_secs = now - timestamp;
            (diff_secs as f64) / 86400.0
        } else {
            30.0
        };
        let apr_historical = self.calculate_historical_apr(total_fees, principal, days_active);

        let (effective_apr, calculation_type) = if apr_historical > 0.0 {
            (apr_historical, "historical")
        } else if !in_range {
            (0.0, "out_of_range")
        } else {
            (0.0, "historical")
        };

        let projections = serde_json::json!([
            {
                "type": "apr",
                "calculationType": calculation_type,
                "projection": self.calculate_projections(effective_apr, total_value),
                "metadata": {
                    "value": effective_apr,
                    "totalFeesGenerated": total_fees,
                    "daysActive": days_active
                }
            }
        ]);

        let mut metadata = serde_json::json!({
            "poolId": position.pool_id,
            "positionId": position.nft_mint,
            "nftMint": position.nft_mint,
            "tick_lower": position.tick_lower,
            "tick_upper": position.tick_upper,
            "tick_current": pool.tick_current,
            "tick_spacing": pool.tick_spacing,
            "liquidity": position.liquidity.to_string(),
            "sqrtPriceX64": pool.sqrt_price_x64.to_string(),
            "range": range_info,
            "inRange": in_range,
            "totalValueUsd": total_value,
            "uncollected_fees_a": fees_a_balance,
            "uncollected_fees_b": fees_b_balance,
            "collected_fees_a": collected.accumulated_a,
            "collected_fees_b": collected.accumulated_b,
            "collected_fees_usd": collected.value_usd,
            "apr": effective_apr,
            "projections": projections,
            "tierPercent": tier_percent,
        });

        if let Some(timestamp) = created_at {
            metadata["createdAt"] = serde_json::json!(timestamp);
        }

        Ok(Some(ProtocolPosition {
            protocol: Protocol::Raydium,
            chain: Chain::Solana,
            wallet_address: wallet_address.to_string(),
            position_type: PositionType::LiquidityPool,
            tokens,
            total_value_usd: total_value,
            metadata,
        }))
    }

    fn calculate_amounts(&self, position: &ClmmPosition, pool: &ClmmPool) -> (u128, u128) {
        if position.liquidity == 0 {
            return (0, 0);
        }

        let sqrt_price_lower = self.tick_to_sqrt_price(position.tick_lower);
        let sqrt_price_upper = self.tick_to_sqrt_price(position.tick_upper);
        let sqrt_price_current = pool.sqrt_price_x64 as f64 / (1u128 << 64) as f64;

        let liquidity = position.liquidity as f64;

        let (amount_a, amount_b) = if pool.tick_current < position.tick_lower {
            let amount_a = liquidity * (1.0 / sqrt_price_lower - 1.0 / sqrt_price_upper);
            (amount_a as u128, 0u128)
        } else if pool.tick_current >= position.tick_upper {
            let amount_b = liquidity * (sqrt_price_upper - sqrt_price_lower);
            (0u128, amount_b as u128)
        } else {
            let amount_a = liquidity * (1.0 / sqrt_price_current - 1.0 / sqrt_price_upper);
            let amount_b = liquidity * (sqrt_price_current - sqrt_price_lower);
            (amount_a as u128, amount_b as u128)
        };

        (amount_a, amount_b)
    }

    fn tick_to_sqrt_price(&self, tick: i32) -> f64 {
        1.0001f64.powf(tick as f64 / 2.0)
    }

    fn tick_to_price(&self, tick: i32) -> f64 {
        1.0001f64.powi(tick)
    }

    async fn calculate_uncollected_fees_with_ticks(
        &self,
        position: &ClmmPosition,
        pool: &ClmmPool,
    ) -> (u128, u128) {
        let tick_lower_data = self
            .fetch_tick_data(&position.pool_id, position.tick_lower, pool.tick_spacing)
            .await;
        let tick_upper_data = self
            .fetch_tick_data(&position.pool_id, position.tick_upper, pool.tick_spacing)
            .await;

        match (tick_lower_data, tick_upper_data) {
            (Some(tick_lower), Some(tick_upper)) => {
                self.calculate_fees_from_ticks(position, pool, &tick_lower, &tick_upper)
            }
            _ => {
                tracing::warn!("[Raydium] Could not fetch tick data, falling back to basic fees");
                self.calculate_fees_fallback(position, pool)
            }
        }
    }

    fn calculate_fees_from_ticks(
        &self,
        position: &ClmmPosition,
        pool: &ClmmPool,
        tick_lower: &ClmmTick,
        tick_upper: &ClmmTick,
    ) -> (u128, u128) {
        let fee_growth_inside_0 = self.calculate_fee_growth_inside(
            position.tick_lower,
            position.tick_upper,
            pool.tick_current,
            pool.fee_growth_global_0_x64,
            tick_lower.fee_growth_outside_0_x64,
            tick_upper.fee_growth_outside_0_x64,
        );

        let fee_growth_inside_1 = self.calculate_fee_growth_inside(
            position.tick_lower,
            position.tick_upper,
            pool.tick_current,
            pool.fee_growth_global_1_x64,
            tick_lower.fee_growth_outside_1_x64,
            tick_upper.fee_growth_outside_1_x64,
        );

        let fee_growth_delta_0 =
            self.subtract_u128(fee_growth_inside_0, position.fee_growth_inside_a);
        let fee_growth_delta_1 =
            self.subtract_u128(fee_growth_inside_1, position.fee_growth_inside_b);

        const Q64: u128 = 1u128 << 64;

        let fees_earned_0 = (position.liquidity * fee_growth_delta_0) / Q64;
        let fees_earned_1 = (position.liquidity * fee_growth_delta_1) / Q64;

        let total_fees_0 = position.fees_owed_token_a as u128 + fees_earned_0;
        let total_fees_1 = position.fees_owed_token_b as u128 + fees_earned_1;

        tracing::debug!(
            "[Raydium] Calculated fees - Token0: {} (owed: {}, earned: {}), Token1: {} (owed: {}, earned: {})",
            total_fees_0, position.fees_owed_token_a, fees_earned_0,
            total_fees_1, position.fees_owed_token_b, fees_earned_1
        );

        (total_fees_0, total_fees_1)
    }

    fn calculate_fees_fallback(&self, position: &ClmmPosition, _pool: &ClmmPool) -> (u128, u128) {
        tracing::debug!(
            "[Raydium] Using fees_owed fallback - TokenA: {}, TokenB: {}",
            position.fees_owed_token_a,
            position.fees_owed_token_b
        );
        (
            position.fees_owed_token_a as u128,
            position.fees_owed_token_b as u128,
        )
    }

    fn calculate_fee_growth_inside(
        &self,
        tick_lower: i32,
        tick_upper: i32,
        tick_current: i32,
        fee_growth_global: u128,
        fee_growth_outside_lower: u128,
        fee_growth_outside_upper: u128,
    ) -> u128 {
        let fee_growth_below = if tick_current >= tick_lower {
            fee_growth_outside_lower
        } else {
            self.subtract_u128(fee_growth_global, fee_growth_outside_lower)
        };

        let fee_growth_above = if tick_current < tick_upper {
            fee_growth_outside_upper
        } else {
            self.subtract_u128(fee_growth_global, fee_growth_outside_upper)
        };

        self.subtract_u128(
            self.subtract_u128(fee_growth_global, fee_growth_below),
            fee_growth_above,
        )
    }

    fn subtract_u128(&self, current: u128, last: u128) -> u128 {
        if current >= last {
            current - last
        } else {
            u128::MAX - last + current + 1
        }
    }

    async fn fetch_tick_data(
        &self,
        pool_id: &str,
        tick_index: i32,
        tick_spacing: u16,
    ) -> Option<ClmmTick> {
        let start_tick_index = self.get_tick_array_start_index(tick_index, tick_spacing as i32);
        let tick_array_pda = match self.derive_tick_array_pda(pool_id, start_tick_index) {
            Some(pda) => pda,
            None => {
                tracing::warn!(
                    "[Raydium] Failed to derive tick array PDA for pool {} tick {}",
                    pool_id,
                    tick_index
                );
                return None;
            }
        };

        let data = match self.fetch_account_data(&tick_array_pda).await {
            Ok(d) if !d.is_empty() => d,
            _ => {
                tracing::warn!(
                    "[Raydium] Failed to fetch tick array data for tick {}",
                    tick_index
                );
                return None;
            }
        };

        self.parse_tick_from_array(&data, tick_index, tick_spacing as i32)
    }

    fn get_tick_array_start_index(&self, tick_index: i32, tick_spacing: i32) -> i32 {
        const TICK_ARRAY_SIZE: i32 = 60;
        let ticks_per_array = tick_spacing * TICK_ARRAY_SIZE;

        let start_index = if tick_index < 0 && tick_index % ticks_per_array != 0 {
            (tick_index as f64 / ticks_per_array as f64).ceil() as i32 - 1
        } else {
            (tick_index as f64 / ticks_per_array as f64).floor() as i32
        };

        start_index * ticks_per_array
    }

    fn derive_tick_array_pda(&self, pool_id: &str, start_tick_index: i32) -> Option<String> {
        let pool_pubkey = Pubkey::from_str(pool_id).ok()?;
        let program_id = Pubkey::from_str(CLMM_PROGRAM_ID).ok()?;

        let seeds: &[&[u8]] = &[
            b"tick_array",
            pool_pubkey.as_ref(),
            &start_tick_index.to_be_bytes(),
        ];

        let (pda, _bump) = Pubkey::find_program_address(seeds, &program_id);
        Some(pda.to_string())
    }

    fn parse_tick_from_array(
        &self,
        data: &[u8],
        target_tick_index: i32,
        tick_spacing: i32,
    ) -> Option<ClmmTick> {
        const TICK_SIZE: usize = 168;
        const TICK_ARRAY_SIZE: usize = 60;
        const HEADER_SIZE: usize = 8 + 32 + 4; // discriminator + pool_id + start_tick_index

        if data.len() < HEADER_SIZE {
            return None;
        }

        let start_tick_index = i32::from_le_bytes(data[40..44].try_into().ok()?);
        let _ticks_per_array = tick_spacing * TICK_ARRAY_SIZE as i32;

        let tick_offset_in_array = ((target_tick_index - start_tick_index) / tick_spacing) as usize;

        if tick_offset_in_array >= TICK_ARRAY_SIZE {
            return None;
        }

        let offset = HEADER_SIZE + (tick_offset_in_array * TICK_SIZE);

        if data.len() < offset + TICK_SIZE {
            return None;
        }

        let tick = ClmmTick {
            tick_index: i32::from_le_bytes(data[offset..offset + 4].try_into().ok()?),
            fee_growth_outside_0_x64: u128::from_le_bytes(
                data[offset + 36..offset + 52].try_into().ok()?,
            ),
            fee_growth_outside_1_x64: u128::from_le_bytes(
                data[offset + 52..offset + 68].try_into().ok()?,
            ),
        };

        Some(tick)
    }

    fn build_range_info(
        &self,
        position: &ClmmPosition,
        pool: &ClmmPool,
        token_a_decimals: u8,
        token_b_decimals: u8,
    ) -> serde_json::Value {
        let decimal_diff = token_a_decimals as i32 - token_b_decimals as i32;
        let decimal_adjustment = 10f64.powi(decimal_diff);

        let price_lower = self.tick_to_price(position.tick_lower) * decimal_adjustment;
        let price_upper = self.tick_to_price(position.tick_upper) * decimal_adjustment;
        let price_current = self.tick_to_price(pool.tick_current) * decimal_adjustment;

        let in_range =
            pool.tick_current >= position.tick_lower && pool.tick_current < position.tick_upper;
        let range_size = if price_lower > 0.0 {
            (price_upper - price_lower) / price_lower
        } else {
            0.0
        };

        serde_json::json!({
            "lower": price_lower,
            "upper": price_upper,
            "current": price_current,
            "inRange": in_range,
            "rangeSize": range_size
        })
    }

    async fn fetch_account_data(&self, address: &str) -> Result<Vec<u8>> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getAccountInfo",
            "params": [
                address,
                {"encoding": "base64"}
            ]
        });

        for attempt in 1..=MAX_RETRIES {
            sleep(Duration::from_millis(RPC_DELAY_MS)).await;

            let response = self
                .client
                .post(&self.rpc_url)
                .json(&body)
                .send()
                .await
                .map_err(|e| DeFi10Error::ExternalApiError(format!("RPC error: {}", e)))?;

            if response.status() == 429 {
                let delay = 2000 * attempt as u64;
                tracing::warn!(
                    "[Raydium] RPC 429 for {}, retrying in {}ms (attempt {}/{})",
                    address,
                    delay,
                    attempt,
                    MAX_RETRIES
                );
                sleep(Duration::from_millis(delay)).await;
                continue;
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| DeFi10Error::ParseError(format!("JSON parse error: {}", e)))?;

            if let Some(result) = json.get("result") {
                if let Some(value) = result.get("value") {
                    if value.is_null() {
                        return Ok(vec![]);
                    }
                    if let Some(data) = value
                        .get("data")
                        .and_then(|d| d.get(0))
                        .and_then(|d| d.as_str())
                    {
                        use base64::Engine;
                        let decoded = base64::engine::general_purpose::STANDARD
                            .decode(data)
                            .map_err(|e| {
                                DeFi10Error::ParseError(format!("Base64 decode error: {}", e))
                            })?;
                        return Ok(decoded);
                    }
                }
            }

            return Ok(vec![]);
        }

        tracing::error!(
            "[Raydium] RPC failed after {} retries for {}",
            MAX_RETRIES,
            address
        );
        Ok(vec![])
    }

    async fn get_token_decimals(&self, mint: &str) -> Result<u8> {
        let data = self.fetch_account_data(mint).await?;
        if data.len() >= 45 {
            Ok(data[44])
        } else {
            Ok(9)
        }
    }

    async fn get_token_symbol(&self, mint: &str) -> String {
        match mint {
            "So11111111111111111111111111111111111111112" => "SOL".to_string(),
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" => "USDC".to_string(),
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" => "USDT".to_string(),
            "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" => "mSOL".to_string(),
            "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj" => "stSOL".to_string(),
            "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" => "jitoSOL".to_string(),
            "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" => "bSOL".to_string(),
            _ => format!("{}...", &mint[..6]),
        }
    }

    async fn fetch_nft_mint_timestamp(&self, nft_mint: &str) -> Option<i64> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [
                nft_mint,
                {
                    "limit": 1000,
                    "commitment": "finalized"
                }
            ]
        });

        for attempt in 1..=MAX_RETRIES {
            sleep(Duration::from_millis(RPC_DELAY_MS)).await;

            let response = match self.client.post(&self.rpc_url).json(&body).send().await {
                Ok(r) => r,
                Err(e) => {
                    tracing::warn!(
                        "[Raydium] RPC error fetching signatures for {}: {}",
                        nft_mint,
                        e
                    );
                    continue;
                }
            };

            if response.status() == 429 {
                let delay = 2000 * attempt as u64;
                tracing::warn!(
                    "[Raydium] RPC 429 for signatures {}, retrying in {}ms",
                    nft_mint,
                    delay
                );
                sleep(Duration::from_millis(delay)).await;
                continue;
            }

            let json: serde_json::Value = match response.json().await {
                Ok(j) => j,
                Err(e) => {
                    tracing::warn!("[Raydium] JSON parse error for signatures: {}", e);
                    return None;
                }
            };

            if let Some(result) = json.get("result").and_then(|r| r.as_array()) {
                if result.is_empty() {
                    return None;
                }
                if let Some(oldest) = result.last() {
                    if let Some(block_time) = oldest.get("blockTime").and_then(|t| t.as_i64()) {
                        tracing::info!(
                            "[Raydium] Found creation timestamp for NFT {}: {}",
                            nft_mint,
                            block_time
                        );
                        return Some(block_time);
                    }
                }
            }

            return None;
        }

        None
    }

    async fn fetch_token_prices(&self, token_a: &str, token_b: &str) -> (f64, f64) {
        let url = format!(
            "{}/mint/price?mints={},{}",
            RAYDIUM_API_V3, token_a, token_b
        );

        match self.client.get(&url).send().await {
            Ok(response) => {
                if let Ok(json) = response.json::<serde_json::Value>().await {
                    if let Some(data) = json.get("data") {
                        let price_a = data
                            .get(token_a)
                            .and_then(|v| {
                                v.as_f64()
                                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                            })
                            .unwrap_or(0.0);
                        let price_b = data
                            .get(token_b)
                            .and_then(|v| {
                                v.as_f64()
                                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                            })
                            .unwrap_or(0.0);
                        return (price_a, price_b);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("[Raydium] Failed to fetch token prices: {}", e);
            }
        }

        (0.0, 0.0)
    }

    fn tick_spacing_to_fee_tier(&self, tick_spacing: u16) -> f64 {
        match tick_spacing {
            1 => 0.0001,
            10 => 0.0005,
            60 => 0.0025,
            100 => 0.005,
            200 => 0.01,
            _ => (tick_spacing as f64) * 0.0001,
        }
    }

    async fn resolve_collected_fees(
        &self,
        position: &ClmmPosition,
        position_pda: &str,
        wallet_address: &str,
        token_mint_a: &str,
        token_mint_b: &str,
        current_fees_a: u128,
        current_fees_b: u128,
        price_a: f64,
        price_b: f64,
    ) -> CollectedFeesResult {
        let store = match &self.position_store {
            Some(s) => s,
            None => {
                return CollectedFeesResult {
                    accumulated_a: 0.0,
                    accumulated_b: 0.0,
                    value_usd: 0.0,
                }
            }
        };

        let state = store.get_by_nft_mint(&position.nft_mint).await;

        let fees_a_u64 = current_fees_a.min(u64::MAX as u128) as u64;
        let fees_b_u64 = current_fees_b.min(u64::MAX as u128) as u64;

        let (prev_a, prev_b, mut acc_a, mut acc_b, last_sig) = match &state {
            Some(s) => (
                s.last_fees_owed_a,
                s.last_fees_owed_b,
                s.accumulated_collected_a,
                s.accumulated_collected_b,
                s.last_scanned_signature.clone(),
            ),
            None => (u64::MAX, u64::MAX, 0.0, 0.0, None),
        };

        let is_first_scan = state.is_none();
        let suspected = is_first_scan
            || (prev_a > 0 && fees_a_u64 == 0)
            || (prev_b > 0 && fees_b_u64 == 0)
            || (prev_a > 1000 && fees_a_u64 < prev_a / 2)
            || (prev_b > 1000 && fees_b_u64 < prev_b / 2)
            || (prev_a > 100 && fees_a_u64 < 100)
            || (prev_b > 100 && fees_b_u64 < 100);

        let mut new_last_sig = last_sig.clone();

        if suspected {
            tracing::info!(
                "[Raydium] Fee collection scan triggered for {} (first={}, prev_a={}, cur_a={}, prev_b={}, cur_b={})",
                position.nft_mint, is_first_scan, prev_a, fees_a_u64, prev_b, fees_b_u64
            );
            if let Some((delta_a, delta_b, sig)) = self
                .scan_collection_transactions(
                    position_pda,
                    wallet_address,
                    token_mint_a,
                    token_mint_b,
                    last_sig.as_deref(),
                )
                .await
            {
                tracing::info!(
                    "[Raydium] Detected collected fees: delta_a={:.6} delta_b={:.6} sig={}",
                    delta_a,
                    delta_b,
                    &sig[..20]
                );
                acc_a += delta_a;
                acc_b += delta_b;
                new_last_sig = Some(sig);
            }
        }

        let new_state = RaydiumPositionState {
            nft_mint: position.nft_mint.clone(),
            wallet_address: wallet_address.to_string(),
            token_mint_a: token_mint_a.to_string(),
            token_mint_b: token_mint_b.to_string(),
            last_fees_owed_a: fees_a_u64,
            last_fees_owed_b: fees_b_u64,
            accumulated_collected_a: acc_a,
            accumulated_collected_b: acc_b,
            last_scanned_signature: new_last_sig,
            last_updated_at: Utc::now(),
        };

        if let Err(e) = store.upsert(&new_state).await {
            tracing::warn!(
                "[Raydium] Failed to persist position state for {}: {}",
                position.nft_mint,
                e
            );
        }

        CollectedFeesResult {
            accumulated_a: acc_a,
            accumulated_b: acc_b,
            value_usd: acc_a * price_a + acc_b * price_b,
        }
    }

    async fn scan_collection_transactions(
        &self,
        nft_mint: &str,
        wallet_address: &str,
        token_mint_a: &str,
        token_mint_b: &str,
        since_signature: Option<&str>,
    ) -> Option<(f64, f64, String)> {
        let sigs = match self.fetch_signatures_since(nft_mint, since_signature).await {
            Ok(s) => s,
            Err(e) => {
                tracing::warn!(
                    "[Raydium] Skipping fee scan for PDA {} due to signatures fetch error: {}. last_scanned_signature kept; will retry next run.",
                    &nft_mint[..nft_mint.len().min(8)],
                    e
                );
                return None;
            }
        };

        if sigs.is_empty() {
            tracing::debug!("[Raydium] No new signatures for position PDA {}", nft_mint);
            return None;
        }

        tracing::info!(
            "[Raydium] Scanning {} transactions for fee collections (PDA {})",
            sigs.len(),
            &nft_mint[..nft_mint.len().min(8)]
        );

        let newest_sig = sigs[0].clone();
        let mut delta_a = 0.0f64;
        let mut delta_b = 0.0f64;
        let mut had_failure = false;
        let mut detected_count = 0usize;

        for sig in &sigs {
            match self
                .parse_collection_from_tx(sig, wallet_address, token_mint_a, token_mint_b)
                .await
            {
                TxParseResult::Detected(da, db) => {
                    delta_a += da;
                    delta_b += db;
                    detected_count += 1;
                }
                TxParseResult::NotCollection => {}
                TxParseResult::Failed(reason) => {
                    had_failure = true;
                    tracing::warn!(
                        "[Raydium] Tx parse failed for {} (reason: {}); will retry on next run",
                        &sig[..sig.len().min(20)],
                        reason
                    );
                }
            }
        }

        if had_failure {
            tracing::warn!(
                "[Raydium] At least one tx parse failed for PDA {} ({} detected, {} sigs total). Not advancing last_scanned_signature to allow retry; partial deltas discarded to avoid double counting.",
                &nft_mint[..nft_mint.len().min(8)],
                detected_count,
                sigs.len()
            );
            return None;
        }

        tracing::info!(
            "[Raydium] Scan complete for PDA {}: {} collections detected out of {} sigs (delta_a={:.6}, delta_b={:.6})",
            &nft_mint[..nft_mint.len().min(8)],
            detected_count,
            sigs.len(),
            delta_a,
            delta_b
        );

        Some((delta_a, delta_b, newest_sig))
    }

    async fn fetch_signatures_since(
        &self,
        address: &str,
        until: Option<&str>,
    ) -> std::result::Result<Vec<String>, String> {
        let mut options = serde_json::json!({
            "limit": 20,
            "commitment": "finalized"
        });

        if let Some(sig) = until {
            options["until"] = serde_json::json!(sig);
        }

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [address, options]
        });

        let mut last_error = String::from("unknown error");

        for attempt in 1..=MAX_RETRIES {
            sleep(Duration::from_millis(RPC_DELAY_MS)).await;

            let response = match self
                .client
                .post(&self.rpc_url)
                .timeout(Duration::from_secs(15))
                .json(&body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    last_error = format!("network error: {}", e);
                    tracing::warn!(
                        "[Raydium] Signatures RPC network error for {} (attempt {}/{}): {}",
                        address,
                        attempt,
                        MAX_RETRIES,
                        e
                    );
                    sleep(Duration::from_millis(1000 * attempt as u64)).await;
                    continue;
                }
            };

            if response.status() == 429 {
                let delay = 2000 * attempt as u64;
                last_error = format!("429 rate limited (attempt {}/{})", attempt, MAX_RETRIES);
                tracing::warn!(
                    "[Raydium] Signatures RPC 429 for {}, retrying in {}ms (attempt {}/{})",
                    address,
                    delay,
                    attempt,
                    MAX_RETRIES
                );
                sleep(Duration::from_millis(delay)).await;
                continue;
            }

            if !response.status().is_success() {
                let status = response.status();
                last_error = format!("http {}", status);
                tracing::warn!(
                    "[Raydium] Signatures RPC non-success status {} for {} (attempt {}/{})",
                    status,
                    address,
                    attempt,
                    MAX_RETRIES
                );
                sleep(Duration::from_millis(1000 * attempt as u64)).await;
                continue;
            }

            let json: serde_json::Value = match response.json().await {
                Ok(j) => j,
                Err(e) => {
                    tracing::warn!(
                        "[Raydium] Signatures RPC JSON parse error for {}: {}",
                        address,
                        e
                    );
                    return Err(format!("json parse error: {}", e));
                }
            };

            if let Some(rpc_err) = json.get("error") {
                tracing::warn!(
                    "[Raydium] Signatures RPC returned error for {}: {}",
                    address,
                    rpc_err
                );
                return Err(format!("rpc error: {}", rpc_err));
            }

            if let Some(result) = json.get("result").and_then(|r| r.as_array()) {
                let sigs: Vec<String> = result
                    .iter()
                    .filter_map(|item| {
                        item.get("signature")
                            .and_then(|s| s.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect();
                return Ok(sigs);
            }

            tracing::warn!(
                "[Raydium] Signatures RPC missing result array for {}",
                address
            );
            return Err("missing result array".to_string());
        }

        tracing::error!(
            "[Raydium] Signatures RPC failed after {} retries for {}: {}",
            MAX_RETRIES,
            address,
            last_error
        );
        Err(last_error)
    }

    async fn parse_collection_from_tx(
        &self,
        signature: &str,
        wallet_address: &str,
        token_mint_a: &str,
        token_mint_b: &str,
    ) -> TxParseResult {
        const WSOL_MINT: &str = "So11111111111111111111111111111111111111112";

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getTransaction",
            "params": [
                signature,
                {
                    "encoding": "jsonParsed",
                    "maxSupportedTransactionVersion": 0
                }
            ]
        });

        let json = match self.fetch_transaction_json(signature, &body).await {
            Ok(j) => j,
            Err(reason) => return TxParseResult::Failed(reason),
        };

        let result = match json.get("result") {
            Some(r) if !r.is_null() => r,
            _ => {
                tracing::warn!(
                    "[Raydium] Tx {} returned null/missing result (likely not finalized yet)",
                    &signature[..signature.len().min(20)]
                );
                return TxParseResult::Failed("null result".to_string());
            }
        };

        let meta = match result.get("meta") {
            Some(m) => m,
            None => {
                tracing::warn!(
                    "[Raydium] Tx {} missing meta field",
                    &signature[..signature.len().min(20)]
                );
                return TxParseResult::Failed("missing meta".to_string());
            }
        };

        if let Some(err) = meta
            .get("err")
            .and_then(|e| if e.is_null() { None } else { Some(e) })
        {
            tracing::debug!(
                "[Raydium] Tx {} failed on-chain (err={}); skipping",
                &signature[..signature.len().min(20)],
                err
            );
            return TxParseResult::NotCollection;
        }

        let pre_token = match meta.get("preTokenBalances").and_then(|v| v.as_array()) {
            Some(a) => a,
            None => {
                tracing::warn!(
                    "[Raydium] Tx {} missing preTokenBalances",
                    &signature[..signature.len().min(20)]
                );
                return TxParseResult::Failed("missing preTokenBalances".to_string());
            }
        };
        let post_token = match meta.get("postTokenBalances").and_then(|v| v.as_array()) {
            Some(a) => a,
            None => {
                tracing::warn!(
                    "[Raydium] Tx {} missing postTokenBalances",
                    &signature[..signature.len().min(20)]
                );
                return TxParseResult::Failed("missing postTokenBalances".to_string());
            }
        };

        let get_spl_amount = |balances: &[serde_json::Value], mint: &str| -> f64 {
            balances
                .iter()
                .filter(|b| {
                    b.get("owner").and_then(|o| o.as_str()) == Some(wallet_address)
                        && b.get("mint").and_then(|m| m.as_str()) == Some(mint)
                })
                .filter_map(|b| {
                    b.get("uiTokenAmount")
                        .and_then(|u| u.get("uiAmount"))
                        .and_then(|a| a.as_f64())
                })
                .sum()
        };

        let get_native_sol_delta = || -> Option<f64> {
            let account_keys = result
                .get("transaction")?
                .get("message")?
                .get("accountKeys")?
                .as_array()?;
            let pre_native = meta.get("preBalances")?.as_array()?;
            let post_native = meta.get("postBalances")?.as_array()?;
            let fee = meta.get("fee")?.as_u64().unwrap_or(0);

            let wallet_idx = account_keys.iter().position(|k| {
                let pubkey = if k.is_string() {
                    k.as_str().unwrap_or("")
                } else {
                    k.get("pubkey").and_then(|p| p.as_str()).unwrap_or("")
                };
                pubkey == wallet_address
            })?;

            let pre = pre_native.get(wallet_idx)?.as_u64()?;
            let post = post_native.get(wallet_idx)?.as_u64()?;
            let gross = post.checked_add(fee)? as f64 - pre as f64;
            Some(gross / 1e9)
        };

        let spl_delta_a = (get_spl_amount(post_token, token_mint_a)
            - get_spl_amount(pre_token, token_mint_a))
        .max(0.0);
        let spl_delta_b = (get_spl_amount(post_token, token_mint_b)
            - get_spl_amount(pre_token, token_mint_b))
        .max(0.0);

        let delta_a = if token_mint_a == WSOL_MINT && spl_delta_a == 0.0 {
            get_native_sol_delta().unwrap_or(0.0).max(0.0)
        } else {
            spl_delta_a
        };

        let delta_b = if token_mint_b == WSOL_MINT && spl_delta_b == 0.0 {
            get_native_sol_delta().unwrap_or(0.0).max(0.0)
        } else {
            spl_delta_b
        };

        if delta_a > 0.0 || delta_b > 0.0 {
            TxParseResult::Detected(delta_a, delta_b)
        } else {
            TxParseResult::NotCollection
        }
    }

    async fn fetch_transaction_json(
        &self,
        signature: &str,
        body: &serde_json::Value,
    ) -> std::result::Result<serde_json::Value, String> {
        let mut last_error = String::from("unknown error");

        for attempt in 1..=MAX_RETRIES {
            sleep(Duration::from_millis(RPC_DELAY_MS)).await;

            let response = match self
                .client
                .post(&self.rpc_url)
                .timeout(Duration::from_secs(15))
                .json(body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    last_error = format!("network error: {}", e);
                    tracing::warn!(
                        "[Raydium] getTransaction network error for {} (attempt {}/{}): {}",
                        &signature[..signature.len().min(20)],
                        attempt,
                        MAX_RETRIES,
                        e
                    );
                    sleep(Duration::from_millis(1000 * attempt as u64)).await;
                    continue;
                }
            };

            if response.status() == 429 {
                let delay = 2000 * attempt as u64;
                last_error = format!("429 rate limited (attempt {}/{})", attempt, MAX_RETRIES);
                tracing::warn!(
                    "[Raydium] getTransaction RPC 429 for {}, retrying in {}ms (attempt {}/{})",
                    &signature[..signature.len().min(20)],
                    delay,
                    attempt,
                    MAX_RETRIES
                );
                sleep(Duration::from_millis(delay)).await;
                continue;
            }

            if !response.status().is_success() {
                let status = response.status();
                last_error = format!("http {}", status);
                tracing::warn!(
                    "[Raydium] getTransaction non-success status {} for {} (attempt {}/{})",
                    status,
                    &signature[..signature.len().min(20)],
                    attempt,
                    MAX_RETRIES
                );
                sleep(Duration::from_millis(1000 * attempt as u64)).await;
                continue;
            }

            match response.json::<serde_json::Value>().await {
                Ok(j) => {
                    if let Some(rpc_err) = j.get("error") {
                        tracing::warn!(
                            "[Raydium] getTransaction RPC returned error for {}: {}",
                            &signature[..signature.len().min(20)],
                            rpc_err
                        );
                        return Err(format!("rpc error: {}", rpc_err));
                    }
                    return Ok(j);
                }
                Err(e) => {
                    tracing::warn!(
                        "[Raydium] getTransaction JSON parse error for {}: {}",
                        &signature[..signature.len().min(20)],
                        e
                    );
                    return Err(format!("json parse error: {}", e));
                }
            }
        }

        tracing::error!(
            "[Raydium] getTransaction failed after {} retries for {}: {}",
            MAX_RETRIES,
            &signature[..signature.len().min(20)],
            last_error
        );
        Err(last_error)
    }

    fn calculate_historical_apr(&self, fees_earned: f64, principal: f64, days: f64) -> f64 {
        if principal <= 0.0 || days <= 0.0 {
            return 0.0;
        }
        let daily_return = fees_earned / principal / days;
        daily_return * 365.0 * 100.0
    }

    fn calculate_projections(&self, apr: f64, total_value: f64) -> serde_json::Value {
        let daily_rate = apr / 100.0 / 365.0;
        serde_json::json!({
            "oneDay": total_value * daily_rate,
            "oneWeek": total_value * daily_rate * 7.0,
            "oneMonth": total_value * daily_rate * 30.0,
            "oneYear": total_value * daily_rate * 365.0
        })
    }
}

struct CollectedFeesResult {
    accumulated_a: f64,
    accumulated_b: f64,
    value_usd: f64,
}

#[derive(Debug)]
enum TxParseResult {
    Detected(f64, f64),
    NotCollection,
    Failed(String),
}

#[derive(Debug)]
struct ClmmPosition {
    nft_mint: String,
    pool_id: String,
    tick_lower: i32,
    tick_upper: i32,
    liquidity: u128,
    fee_growth_inside_a: u128,
    fee_growth_inside_b: u128,
    fees_owed_token_a: u64,
    fees_owed_token_b: u64,
}

impl ClmmPosition {
    fn parse(data: &[u8]) -> Result<Self> {
        if data.len() < 217 {
            return Err(DeFi10Error::ParseError(format!(
                "Invalid position data size: {}, expected >= 217",
                data.len()
            )));
        }

        let nft_mint = bs58::encode(&data[9..41]).into_string();
        let pool_id = bs58::encode(&data[41..73]).into_string();
        let tick_lower = i32::from_le_bytes(data[73..77].try_into().unwrap());
        let tick_upper = i32::from_le_bytes(data[77..81].try_into().unwrap());
        let liquidity = u128::from_le_bytes(data[81..97].try_into().unwrap());
        let fee_growth_inside_a = u128::from_le_bytes(data[97..113].try_into().unwrap());
        let fee_growth_inside_b = u128::from_le_bytes(data[113..129].try_into().unwrap());
        let fees_owed_token_a = u64::from_le_bytes(data[129..137].try_into().unwrap());
        let fees_owed_token_b = u64::from_le_bytes(data[137..145].try_into().unwrap());

        Ok(Self {
            nft_mint,
            pool_id,
            tick_lower,
            tick_upper,
            liquidity,
            fee_growth_inside_a,
            fee_growth_inside_b,
            fees_owed_token_a,
            fees_owed_token_b,
        })
    }
}

#[derive(Debug)]
struct ClmmPool {
    token_mint_a: String,
    token_mint_b: String,
    tick_current: i32,
    tick_spacing: u16,
    sqrt_price_x64: u128,
    fee_growth_global_0_x64: u128,
    fee_growth_global_1_x64: u128,
}

impl ClmmPool {
    fn parse(data: &[u8], _pool_address: &str) -> Result<Self> {
        if data.len() < 300 {
            return Err(DeFi10Error::ParseError(format!(
                "Invalid pool data size: {}, expected >= 300",
                data.len()
            )));
        }

        let mut offset = 8 + 1 + 32 + 32;
        let token_mint_a = bs58::encode(&data[offset..offset + 32]).into_string();
        offset += 32;
        let token_mint_b = bs58::encode(&data[offset..offset + 32]).into_string();
        offset += 32 + 32 + 32 + 32 + 1 + 1;

        let tick_spacing = u16::from_le_bytes(data[offset..offset + 2].try_into().unwrap());
        offset += 2;

        offset += 16;
        let sqrt_price_x64 = u128::from_le_bytes(data[offset..offset + 16].try_into().unwrap());
        offset += 16;
        let tick_current = i32::from_le_bytes(data[offset..offset + 4].try_into().unwrap());
        offset += 4;

        offset += 2 + 2;

        let fee_growth_global_0_x64 =
            u128::from_le_bytes(data[offset..offset + 16].try_into().unwrap());
        offset += 16;
        let fee_growth_global_1_x64 =
            u128::from_le_bytes(data[offset..offset + 16].try_into().unwrap());

        Ok(Self {
            token_mint_a,
            token_mint_b,
            tick_current,
            tick_spacing,
            sqrt_price_x64,
            fee_growth_global_0_x64,
            fee_growth_global_1_x64,
        })
    }
}

#[derive(Debug)]
struct ClmmTick {
    #[allow(dead_code)]
    tick_index: i32,
    fee_growth_outside_0_x64: u128,
    fee_growth_outside_1_x64: u128,
}

impl Default for RaydiumService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let service = RaydiumService::new();
        assert!(!service.rpc_url.is_empty());
    }

    #[test]
    fn test_derive_position_pda() {
        let service = RaydiumService::new();
        let result = service.derive_position_pda("So11111111111111111111111111111111111111112");
        assert!(result.is_ok());
    }
}
