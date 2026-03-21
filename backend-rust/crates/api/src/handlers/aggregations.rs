use super::wallet_item::*;
use crate::{
    middleware::{ApiResult, AuthUser},
    state::AppState,
};
use axum::{
    extract::Path,
    extract::State,
    http::{Extensions, StatusCode},
    Json,
};
use defi10_core::aggregation::{AggregationJob, AggregationResult, JobStatus};
use defi10_core::DeFi10Error;
use defi10_infrastructure::aggregation::{AggregationPublisher, JobManager};
use defi10_infrastructure::messaging::MessagePublisher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregationRequest {
    pub wallet_group_id: Option<Uuid>,
    pub accounts: Option<Vec<String>>,
    pub chains: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregationResponse {
    pub job_id: Uuid,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStatusResponse {
    pub job_id: Uuid,
    pub status: String,
    pub accounts: Vec<String>,
    pub chains: Vec<String>,
    pub wallet_group_id: Option<Uuid>,
    pub expected_total: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub timed_out: u32,
    pub processed_count: u32,
    pub is_final: bool,
    pub created_at: String,
    pub expires_in_seconds: Option<i64>,
    pub active: bool,
    pub items: Vec<WalletItem>,
    pub summary: AggregationSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AggregationSummary {
    pub total_tokens: u32,
    pub total_aave_supplies: u32,
    pub total_aave_borrows: u32,
    pub total_uniswap_positions: u32,
    pub total_pendle_locks: u32,
    pub total_pendle_deposits: u32,
    pub total_raydium_positions: u32,
    pub total_kamino_positions: u32,
}

/// POST /api/v1/aggregations - Start new aggregation job (ASYNC)
pub async fn start_aggregation(
    State(state): State<Arc<AppState>>,
    extensions: Extensions,
    Json(request): Json<AggregationRequest>,
) -> ApiResult<Json<AggregationResponse>> {
    // Get default chains if not provided
    let chains = request.chains.unwrap_or_else(|| {
        vec![
            "ethereum".to_string(),
            "base".to_string(),
            "arbitrum".to_string(),
            "bnb".to_string(),
            "solana".to_string(),
        ]
    });

    // Get accounts from request or wallet group
    let accounts = if let Some(accts) = request.accounts {
        accts
    } else if let Some(wg_id) = request.wallet_group_id {
        // Fetch accounts from wallet group
        tracing::info!("Fetching wallet group: {}", wg_id);
        let wallet_group = state
            .wallet_group_repo
            .get(&wg_id)
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch wallet group: {}", e)))?
            .ok_or_else(|| {
                tracing::warn!("Wallet group {} not found in database", wg_id);
                DeFi10Error::NotFound(format!("Wallet group {} not found", wg_id))
            })?;

        // Check ownership if authenticated
        if let Some(auth_user) = extensions.get::<AuthUser>() {
            if let Some(ref owner_id) = wallet_group.user_id {
                if owner_id != &auth_user.user_id {
                    return Err(DeFi10Error::Forbidden(
                        "You don't have permission to use this wallet group".to_string(),
                    )
                    .into());
                }
            }
        }

        tracing::info!(
            "Using accounts from wallet group '{}': {} accounts",
            wallet_group.display_name.as_deref().unwrap_or("Unnamed"),
            wallet_group.accounts.len()
        );
        wallet_group.accounts
    } else {
        return Err(DeFi10Error::Validation(
            "Either accounts or walletGroupId must be provided".to_string(),
        )
        .into());
    };

    if accounts.is_empty() {
        return Err(
            DeFi10Error::Validation("At least one account must be provided".to_string()).into(),
        );
    }

    // Create job
    let job = AggregationJob::new(accounts, chains, request.wallet_group_id);
    let job_id = job.job_id;

    // Save job to Redis
    let job_manager = JobManager::new(&state.config.redis.url)
        .map_err(|e| DeFi10Error::Cache(format!("Redis connection error: {}", e)))?;

    job_manager
        .create_job(&job)
        .map_err(|e| DeFi10Error::Cache(format!("Failed to create job: {}", e)))?;

    // Publish messages to RabbitMQ for processing
    let message_publisher = MessagePublisher::new((*state.messaging).clone());
    let agg_publisher = AggregationPublisher::new(message_publisher, None);

    let published_count = agg_publisher
        .publish_job(job_id, &job.accounts, &job.chains, job.wallet_group_id)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to publish job: {}", e)))?;

    // Update job status to Processing after publishing
    job_manager
        .update_job_status(&job_id, JobStatus::Processing)
        .map_err(|e| DeFi10Error::Cache(format!("Failed to update job status: {}", e)))?;

    tracing::info!(
        "Published {} messages for job {} ({} accounts × {} chains)",
        published_count,
        job_id,
        job.accounts.len(),
        job.chains.len()
    );

    Ok(Json(AggregationResponse {
        job_id,
        status: "processing".to_string(),
        message: format!(
            "Aggregation job created with ID: {} and {} messages published",
            job_id, published_count
        ),
    }))
}

/// GET /api/v1/aggregations/{jobId} - Get job status and results
pub async fn get_job_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<Uuid>,
) -> ApiResult<Json<JobStatusResponse>> {
    let job_manager = JobManager::new(&state.config.redis.url)
        .map_err(|e| DeFi10Error::Cache(format!("Redis connection error: {}", e)))?;

    let snapshot = job_manager
        .get_snapshot(&job_id)
        .map_err(|e| DeFi10Error::Cache(format!("Failed to get job: {}", e)))?
        .ok_or_else(|| DeFi10Error::NotFound(format!("Job {} not found", job_id)))?;

    let (mut items, summary) = transform_results_to_items(&snapshot.results);

    hydrate_logos(&mut items, &state.token_logo_service).await;

    Ok(Json(JobStatusResponse {
        job_id: snapshot.job_id,
        status: snapshot.status.to_string(),
        accounts: snapshot.accounts,
        chains: snapshot.chains,
        wallet_group_id: snapshot.wallet_group_id,
        expected_total: snapshot.expected_total,
        succeeded: snapshot.succeeded,
        failed: snapshot.failed,
        timed_out: snapshot.timed_out,
        processed_count: snapshot.processed_count,
        is_final: snapshot.is_final,
        created_at: snapshot.created_at.to_rfc3339(),
        expires_in_seconds: snapshot.expires_in_seconds,
        active: snapshot.active,
        items,
        summary,
    }))
}

async fn hydrate_logos(
    items: &mut [WalletItem],
    logo_service: &defi10_infrastructure::TokenLogoService,
) {
    let addresses: Vec<String> = items
        .iter()
        .flat_map(|item| {
            item.position
                .tokens
                .iter()
                .map(|t| t.contract_address.clone())
                .filter(|addr| !addr.is_empty())
        })
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    if addresses.is_empty() {
        return;
    }

    let logos = match logo_service.get_token_logos_batch(&addresses).await {
        Ok(logos) => logos,
        Err(e) => {
            tracing::warn!("Failed to fetch token logos: {}", e);
            std::collections::HashMap::new()
        }
    };

    for item in items.iter_mut() {
        for token in item.position.tokens.iter_mut() {
            if token.logo.is_some() {
                continue;
            }

            let addr_lower = token.contract_address.to_lowercase();
            if let Some(logo_url) = logos.get(&addr_lower) {
                token.logo = Some(logo_url.clone());
                token.thumbnail = Some(logo_url.clone());
            } else if let Some(static_logo) = get_static_token_logo(&token.symbol, &addr_lower) {
                token.logo = Some(static_logo.to_string());
                token.thumbnail = Some(static_logo.to_string());
            }
        }
    }
}

fn get_static_token_logo(symbol: &str, address: &str) -> Option<&'static str> {
    match symbol.to_uppercase().as_str() {
        "ETH" | "WETH" => Some("https://assets.coingecko.com/coins/images/279/large/ethereum.png"),
        "BTC" | "WBTC" => {
            Some("https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png")
        }
        "CBBTC" => Some("https://assets.coingecko.com/coins/images/40143/large/cbbtc.webp"),
        "USDC" => Some("https://assets.coingecko.com/coins/images/6319/large/usdc.png"),
        "USDT" => Some("https://assets.coingecko.com/coins/images/325/large/Tether.png"),
        "DAI" => Some("https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png"),
        "SOL" | "WSOL" => Some("https://assets.coingecko.com/coins/images/4128/large/solana.png"),
        "BNB" | "WBNB" => {
            Some("https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png")
        }
        "MATIC" | "WMATIC" | "POL" => {
            Some("https://assets.coingecko.com/coins/images/4713/large/polygon.png")
        }
        "ARB" => Some(
            "https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg",
        ),
        "OP" => Some("https://assets.coingecko.com/coins/images/25244/large/Optimism.png"),
        "AAVE" => Some("https://assets.coingecko.com/coins/images/12645/large/AAVE.png"),
        "LINK" => {
            Some("https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png")
        }
        "UNI" => Some("https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png"),
        "CRV" => Some("https://assets.coingecko.com/coins/images/12124/large/Curve.png"),
        "COMP" => Some("https://assets.coingecko.com/coins/images/10775/large/COMP.png"),
        "MKR" => Some("https://assets.coingecko.com/coins/images/1364/large/Mark_Maker.png"),
        "SNX" => Some("https://assets.coingecko.com/coins/images/3406/large/SNX.png"),
        "SUSHI" => {
            Some("https://assets.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png")
        }
        "YFI" => Some("https://assets.coingecko.com/coins/images/11849/large/yearn.jpg"),
        "1INCH" => Some("https://assets.coingecko.com/coins/images/13469/large/1inch-token.png"),
        "GRT" => Some("https://assets.coingecko.com/coins/images/13397/large/Graph_Token.png"),
        "LDO" => Some("https://assets.coingecko.com/coins/images/13573/large/Lido_DAO.png"),
        "STETH" | "WSTETH" => {
            Some("https://assets.coingecko.com/coins/images/13442/large/steth_logo.png")
        }
        "RETH" => Some("https://assets.coingecko.com/coins/images/20764/large/reth.png"),
        "CBETH" => Some("https://assets.coingecko.com/coins/images/27008/large/cbeth.png"),
        "WEETH" => Some("https://assets.coingecko.com/coins/images/33033/large/weETH.png"),
        "FRAX" => Some("https://assets.coingecko.com/coins/images/13422/large/FRAX_icon.png"),
        "LUSD" => Some("https://assets.coingecko.com/coins/images/14666/large/Group_3.png"),
        "SUSD" | "SUSDE" => Some("https://assets.coingecko.com/coins/images/5013/large/sUSD.png"),
        "USDE" => Some("https://assets.coingecko.com/coins/images/33613/large/USDE.png"),
        "GHO" => Some("https://assets.coingecko.com/coins/images/30663/large/gho.png"),
        "PYUSD" => {
            Some("https://assets.coingecko.com/coins/images/31212/large/PYUSD_Logo_%282%29.png")
        }
        "RAY" => Some("https://assets.coingecko.com/coins/images/13928/large/PSigc4ie_400x400.jpg"),
        "JUP" => Some("https://assets.coingecko.com/coins/images/34188/large/jup.png"),
        "BONK" => Some("https://assets.coingecko.com/coins/images/28600/large/bonk.jpg"),
        "JTO" => Some("https://assets.coingecko.com/coins/images/33228/large/jto.png"),
        "JITOSOL" => Some("https://assets.coingecko.com/coins/images/28046/large/JitoSOL-200.png"),
        "MSOL" => Some("https://assets.coingecko.com/coins/images/17752/large/mSOL.png"),
        "BSOL" => Some("https://assets.coingecko.com/coins/images/26636/large/blazesolana.png"),
        _ => match address {
            "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" => {
                Some("https://assets.coingecko.com/coins/images/40143/large/cbbtc.webp")
            }
            "0x4200000000000000000000000000000000000006" => {
                Some("https://assets.coingecko.com/coins/images/279/large/ethereum.png")
            }
            "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" => {
                Some("https://assets.coingecko.com/coins/images/6319/large/usdc.png")
            }
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" => {
                Some("https://assets.coingecko.com/coins/images/279/large/ethereum.png")
            }
            _ => None,
        },
    }
}

fn transform_results_to_items(
    results: &[AggregationResult],
) -> (Vec<WalletItem>, AggregationSummary) {
    let mut items = Vec::new();
    let mut summary = AggregationSummary::default();

    let mut grouped: HashMap<String, Vec<&AggregationResult>> = HashMap::new();
    for result in results {
        let key = if is_lending_protocol(&result.protocol) {
            format!(
                "{}:{}:{}:{}",
                result.protocol, result.chain, result.position_type, result.token_address
            )
        } else {
            format!(
                "{}:{}:{}",
                result.protocol, result.chain, result.position_type
            )
        };
        grouped.entry(key).or_default().push(result);
    }

    for (_key, group_results) in grouped {
        if group_results.is_empty() {
            continue;
        }

        let first = group_results[0];
        let chain = &first.chain;
        let protocol = &first.protocol;
        let position_type = &first.position_type;

        let item_type = determine_item_type(protocol, position_type);
        let protocol_info = create_protocol_info(protocol, chain);
        let label = determine_label(protocol, position_type);

        let mut tokens = Vec::new();
        for result in &group_results {
            update_summary(&mut summary, protocol, position_type);

            let token_type = result
                .token_type
                .as_ref()
                .and_then(|tt| string_to_token_type(tt))
                .or_else(|| determine_token_type(position_type));
            let price = if result.price_usd > 0.0 {
                Some(result.price_usd)
            } else {
                None
            };
            let financials =
                TokenFinancials::from_raw_string(&result.balance_raw, result.decimals, price);

            let mut token = Token::new(
                &result.token_symbol,
                &result.token_name,
                chain,
                &result.token_address,
                financials,
            );

            if let Some(tt) = token_type {
                token = token.with_type(tt);
            }

            token.logo = result.logo.clone();

            tokens.push(token);
        }

        let position = Position::new(&label, tokens);

        let additional_data = create_additional_data(protocol, position_type, &group_results);

        items.push(WalletItem {
            item_type,
            protocol: protocol_info,
            position,
            additional_data,
        });
    }

    (items, summary)
}

fn determine_item_type(protocol: &str, position_type: &str) -> WalletItemType {
    match protocol.to_lowercase().as_str() {
        "native" | "wallet" | "moralis" => WalletItemType::Wallet,
        "aave-v3" => WalletItemType::LendingAndBorrowing,
        "uniswap-v3" | "raydium" => WalletItemType::LiquidityPool,
        "kamino" => WalletItemType::LendingAndBorrowing,
        "pendle" => match position_type.to_lowercase().as_str() {
            "locking" => WalletItemType::Locking,
            _ => WalletItemType::Depositing,
        },
        _ => WalletItemType::from_position_type(position_type),
    }
}

fn create_protocol_info(protocol: &str, chain: &str) -> ProtocolInfo {
    match protocol.to_lowercase().as_str() {
        "native" | "wallet" | "moralis" => ProtocolInfo::wallet(chain),
        "aave-v3" => ProtocolInfo::aave_v3(chain),
        "uniswap-v3" => ProtocolInfo::uniswap_v3(chain),
        "raydium" => ProtocolInfo::raydium(chain),
        "kamino" => ProtocolInfo::kamino(chain),
        "pendle" => ProtocolInfo::pendle(chain),
        _ => ProtocolInfo::new(protocol, chain, protocol),
    }
}

fn determine_label(protocol: &str, position_type: &str) -> String {
    match protocol.to_lowercase().as_str() {
        "native" | "wallet" | "moralis" => "Wallet".to_string(),
        "aave-v3" => match position_type.to_lowercase().as_str() {
            "lending" => "Supplied".to_string(),
            "borrowing" => "Borrowed".to_string(),
            "transaction_history" => "Transaction History - Hidden".to_string(),
            _ => position_type.to_string(),
        },
        "uniswap-v3" | "raydium" => "Liquidity Pool".to_string(),
        "kamino" => match position_type.to_lowercase().as_str() {
            "lending" => "Supplied".to_string(),
            "borrowing" => "Borrowed".to_string(),
            "transaction_history" => "Transaction History - Hidden".to_string(),
            _ => "Position".to_string(),
        },
        "pendle" => match position_type.to_lowercase().as_str() {
            "locking" => "vePENDLE Lock".to_string(),
            _ => "Deposited".to_string(),
        },
        _ => position_type.to_string(),
    }
}

fn determine_token_type(position_type: &str) -> Option<TokenType> {
    match position_type.to_lowercase().as_str() {
        "lending" => Some(TokenType::Supplied),
        "borrowing" => Some(TokenType::Borrowed),
        _ => None,
    }
}

fn string_to_token_type(s: &str) -> Option<TokenType> {
    match s.to_lowercase().as_str() {
        "supplied" => Some(TokenType::Supplied),
        "borrowed" => Some(TokenType::Borrowed),
        "liquidityuncollectedfee" => Some(TokenType::LiquidityUncollectedFee),
        "liquiditycollectedfee" => Some(TokenType::LiquidityCollectedFee),
        "governancepower" => Some(TokenType::GovernancePower),
        _ => None,
    }
}

fn is_lending_protocol(protocol: &str) -> bool {
    matches!(protocol.to_lowercase().as_str(), "aave-v3" | "kamino")
}

fn update_summary(summary: &mut AggregationSummary, protocol: &str, position_type: &str) {
    match protocol.to_lowercase().as_str() {
        "native" | "wallet" | "moralis" => summary.total_tokens += 1,
        "aave-v3" => {
            if position_type.to_lowercase() == "lending" {
                summary.total_aave_supplies += 1;
            } else if position_type.to_lowercase() == "borrowing" {
                summary.total_aave_borrows += 1;
            }
        }
        "uniswap-v3" => summary.total_uniswap_positions += 1,
        "raydium" => summary.total_raydium_positions += 1,
        "kamino" => summary.total_kamino_positions += 1,
        "pendle" => {
            if position_type.to_lowercase() == "locking" {
                summary.total_pendle_locks += 1;
            } else {
                summary.total_pendle_deposits += 1;
            }
        }
        _ => {}
    }
}

fn create_additional_data(
    protocol: &str,
    _position_type: &str,
    results: &[&AggregationResult],
) -> Option<AdditionalData> {
    match protocol.to_lowercase().as_str() {
        "aave-v3" => create_lending_additional_data(results, false, true),
        "kamino" => create_lending_additional_data(results, true, false),
        "raydium" | "uniswap-v3" => create_liquidity_pool_additional_data(protocol, results),
        "pendle" => {
            let metadata = results.first()?.metadata.as_ref();
            let unlock_at = metadata.and_then(|m| m.get("unlockAt").and_then(|v| v.as_i64()));
            Some(AdditionalData {
                unlock_at,
                ..Default::default()
            })
        }
        _ => None,
    }
}

fn create_lending_additional_data(
    results: &[&AggregationResult],
    default_collateral: bool,
    include_repays: bool,
) -> Option<AdditionalData> {
    let first = results.first()?;
    let metadata = first.metadata.as_ref();

    let health_factor = first
        .health_factor
        .or_else(|| metadata.and_then(|m| m.get("healthFactor").and_then(|v| v.as_f64())));
    let apy = first
        .apy
        .or_else(|| metadata.and_then(|m| m.get("apy").and_then(|v| v.as_f64())));

    let is_collateral = first
        .is_collateral
        .or_else(|| metadata.and_then(|m| m.get("isCollateral").and_then(|v| v.as_bool())));
    let can_be_collateral = first
        .can_be_collateral
        .or_else(|| metadata.and_then(|m| m.get("canBeCollateral").and_then(|v| v.as_bool())));

    let is_collateral = if default_collateral {
        is_collateral.or(Some(true))
    } else {
        is_collateral
    };
    let can_be_collateral = if default_collateral {
        can_be_collateral.or(Some(true))
    } else {
        can_be_collateral
    };

    let projections =
        extract_projections(metadata).or_else(|| compute_apy_projection(apy, results));

    let supplies: Option<Vec<SupplyItem>> = metadata
        .and_then(|m| m.get("supplies"))
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let borrows: Option<Vec<BorrowItem>> = metadata
        .and_then(|m| m.get("borrows"))
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let supplies_tokens: Option<Vec<TokenInfo>> = metadata
        .and_then(|m| m.get("suppliesTokens"))
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let borrows_tokens: Option<Vec<TokenInfo>> = metadata
        .and_then(|m| m.get("borrowsTokens"))
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    let repays = if include_repays {
        metadata
            .and_then(|m| m.get("repays"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    } else {
        None
    };
    let repays_tokens = if include_repays {
        metadata
            .and_then(|m| m.get("repaysTokens"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
    } else {
        None
    };

    Some(AdditionalData {
        health_factor,
        apy,
        is_collateral,
        can_be_collateral,
        projections,
        supplies,
        borrows,
        repays,
        supplies_tokens,
        borrows_tokens,
        repays_tokens,
        ..Default::default()
    })
}

fn create_liquidity_pool_additional_data(
    protocol: &str,
    results: &[&AggregationResult],
) -> Option<AdditionalData> {
    let first = results.first()?;
    let metadata = first.metadata.as_ref();

    let apr = first
        .apr
        .or_else(|| metadata.and_then(|m| m.get("apr").and_then(|v| v.as_f64())));
    let pool_id = metadata.and_then(|m| {
        m.get("poolId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    let tier_percent = metadata.and_then(|m| m.get("tierPercent").and_then(|v| v.as_f64()));
    let created_at = metadata.and_then(|m| m.get("createdAt").and_then(|v| v.as_i64()));

    let range = metadata.and_then(|m| m.get("range")).map(|r| RangeInfo {
        lower: r.get("lower").and_then(|v| v.as_f64()),
        upper: r.get("upper").and_then(|v| v.as_f64()),
        current: r.get("current").and_then(|v| v.as_f64()),
        in_range: r.get("inRange").and_then(|v| v.as_bool()),
        range_size: r.get("rangeSize").and_then(|v| v.as_f64()),
    });

    let supplied_value: f64 = results
        .iter()
        .filter(|r| {
            r.token_type
                .as_deref()
                .map(|t| t == "Supplied")
                .unwrap_or(false)
        })
        .map(|r| r.value_usd)
        .sum();
    let total_value_usd = if supplied_value > 0.0 {
        Some(supplied_value)
    } else if protocol == "raydium" {
        metadata.and_then(|m| m.get("totalValueUsd").and_then(|v| v.as_f64()))
    } else {
        None
    };

    let (projections, apr_historical) =
        compute_fee_projections(results, created_at, total_value_usd);

    let mut data = AdditionalData {
        apr,
        apr_historical,
        pool_id,
        tier_percent,
        total_value_usd,
        range,
        projections,
        created_at,
        ..Default::default()
    };

    if protocol == "uniswap-v3" {
        data.tick_spacing = metadata.and_then(|m| {
            m.get("tickSpacing")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
        });
        data.sqrt_price_x96 = metadata.and_then(|m| {
            m.get("sqrtPriceX96")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });
    }

    Some(data)
}

fn compute_fee_projections(
    results: &[&AggregationResult],
    created_at: Option<i64>,
    total_value_usd: Option<f64>,
) -> (Option<Vec<ProjectionData>>, Option<f64>) {
    let total_fees_usd: f64 = results
        .iter()
        .filter(|r| {
            r.token_type
                .as_deref()
                .map(|t| t == "LiquidityUncollectedFee" || t == "LiquidityCollectedFee")
                .unwrap_or(false)
        })
        .map(|r| r.value_usd)
        .sum();

    let mut projections = Vec::new();
    let mut apr_historical = None;

    if let (Some(created_ts), Some(value_usd)) = (created_at, total_value_usd) {
        if total_fees_usd > 0.0 && value_usd > 0.0 {
            let now = chrono::Utc::now().timestamp();
            let days_active = ((now - created_ts) as f64 / 86400.0).max(0.1);
            let daily_rate = total_fees_usd / days_active;
            let historical_apr = (total_fees_usd / value_usd) * (365.0 / days_active) * 100.0;

            apr_historical = Some(historical_apr);

            projections.push(ProjectionData {
                projection_type: "apr".to_string(),
                calculation_type: Some("historical".to_string()),
                projection: Projection {
                    one_day: daily_rate,
                    one_week: daily_rate * 7.0,
                    one_month: daily_rate * 30.0,
                    one_year: daily_rate * 365.0,
                },
                metadata: Some(serde_json::json!({
                    "apr": historical_apr,
                    "createdAt": created_ts,
                    "totalFeesGenerated": total_fees_usd,
                    "daysActive": days_active
                })),
            });
        }
    }

    let projections = if projections.is_empty() {
        None
    } else {
        Some(projections)
    };
    (projections, apr_historical)
}

fn extract_projections(metadata: Option<&serde_json::Value>) -> Option<Vec<ProjectionData>> {
    metadata.and_then(|m| m.get("projections")).and_then(|p| {
        if let Some(arr) = p.as_array() {
            let projections: Vec<ProjectionData> = arr
                .iter()
                .filter_map(|item| {
                    let projection_type = item.get("type")?.as_str()?.to_string();
                    let calculation_type = item
                        .get("calculationType")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let proj = item.get("projection")?;
                    Some(ProjectionData {
                        projection_type,
                        calculation_type,
                        projection: Projection {
                            one_day: proj.get("oneDay").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            one_week: proj.get("oneWeek").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            one_month: proj.get("oneMonth").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            one_year: proj.get("oneYear").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        },
                        metadata: item.get("metadata").cloned(),
                    })
                })
                .collect();
            if projections.is_empty() {
                None
            } else {
                Some(projections)
            }
        } else {
            None
        }
    })
}

fn compute_apy_projection(
    apy: Option<f64>,
    results: &[&AggregationResult],
) -> Option<Vec<ProjectionData>> {
    let apy_val = apy?;
    let total_value_usd: f64 = results.iter().map(|r| r.value_usd).sum();
    if total_value_usd <= 0.0 {
        return None;
    }
    let rate = apy_val / 100.0;
    Some(vec![ProjectionData {
        projection_type: "apy".to_string(),
        calculation_type: Some("protocol".to_string()),
        projection: Projection {
            one_day: total_value_usd * rate / 365.0,
            one_week: total_value_usd * rate / 52.0,
            one_month: total_value_usd * rate / 12.0,
            one_year: total_value_usd * rate,
        },
        metadata: Some(serde_json::json!({ "apy": apy_val })),
    }])
}

fn extract_transaction_history(result: &AggregationResult) -> Option<AdditionalData> {
    let metadata = result.metadata.as_ref()?;
    let health_factor = metadata.get("healthFactor").and_then(|v| v.as_f64());

    let supplies: Option<Vec<SupplyItem>> = metadata
        .get("supplies")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let borrows: Option<Vec<BorrowItem>> = metadata
        .get("borrows")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let repays: Option<Vec<RepayItem>> = metadata
        .get("repays")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let supplies_tokens: Option<Vec<TokenInfo>> = metadata
        .get("suppliesTokens")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let borrows_tokens: Option<Vec<TokenInfo>> = metadata
        .get("borrowsTokens")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let repays_tokens: Option<Vec<TokenInfo>> = metadata
        .get("repaysTokens")
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    Some(AdditionalData {
        health_factor,
        supplies,
        borrows,
        repays,
        supplies_tokens,
        borrows_tokens,
        repays_tokens,
        ..Default::default()
    })
}

fn token_symbol_to_name(symbol: &str) -> String {
    match symbol.to_uppercase().as_str() {
        "ETH" => "Ether".to_string(),
        "WETH" => "Wrapped Ether".to_string(),
        "BTC" | "WBTC" => "Wrapped Bitcoin".to_string(),
        "CBBTC" => "Coinbase Wrapped BTC".to_string(),
        "USDC" => "USD Coin".to_string(),
        "USDT" => "Tether USD".to_string(),
        "DAI" => "Dai Stablecoin".to_string(),
        "SOL" => "Solana".to_string(),
        "WSOL" => "Wrapped SOL".to_string(),
        _ => symbol.to_string(),
    }
}

// Keep old endpoint for backward compatibility (returns immediately with mock data)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OldAggregationResponse {
    pub wallet_group_id: String,
    pub total_value_usd: f64,
    pub positions: Vec<serde_json::Value>,
    pub chains: Vec<String>,
    pub protocols: Vec<String>,
}

pub async fn get_aggregations(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> ApiResult<Json<OldAggregationResponse>> {
    let wallet_group_id = request
        .get("walletGroupId")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(Json(OldAggregationResponse {
        wallet_group_id,
        total_value_usd: 0.0,
        positions: vec![],
        chains: vec![],
        protocols: vec![],
    }))
}

#[cfg(test)]
mod tests {
    use defi10_core::WalletGroup;
    use uuid::Uuid;

    #[test]
    fn test_wallet_group_for_aggregation() {
        let group = WalletGroup::new(
            Some("Test Group".to_string()),
            vec![
                "0x1234567890123456789012345678901234567890".to_string(),
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd".to_string(),
            ],
            Some("user123".to_string()),
        );

        assert_eq!(group.accounts.len(), 2);
        assert!(!group.id.is_nil());
    }

    #[test]
    fn test_wallet_group_uuid_generation() {
        let group = WalletGroup::new(
            None,
            vec!["0x1234567890123456789012345678901234567890".to_string()],
            Some("owner123".to_string()),
        );

        let id_str = group.id.to_string();
        let parsed = Uuid::parse_str(&id_str);
        assert!(parsed.is_ok());
    }
}
