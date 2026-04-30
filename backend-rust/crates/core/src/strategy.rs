use chrono::{DateTime, Datelike, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use uuid::Uuid;

fn serialize_uuid<S>(uuid: &Uuid, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&uuid.to_string())
}

fn deserialize_uuid<'de, D>(deserializer: D) -> Result<Uuid, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Ok(Uuid::parse_str(&s).unwrap_or(Uuid::nil()))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize_repr, Deserialize_repr)]
#[repr(i32)]
pub enum StrategyType {
    AllocationByWeight = 1,
    HealthFactorTarget = 2,
    BestPurchaseWindow = 8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WindowPeriod {
    H1,
    H24,
    D7,
    D14,
    D30,
    D90,
    D200,
    Y1,
    Ytd,
}

impl WindowPeriod {
    pub fn start_unix(&self, now: i64) -> i64 {
        match self {
            WindowPeriod::H1 => now - 3_600,
            WindowPeriod::H24 => now - 86_400,
            WindowPeriod::D7 => now - 7 * 86_400,
            WindowPeriod::D14 => now - 14 * 86_400,
            WindowPeriod::D30 => now - 30 * 86_400,
            WindowPeriod::D90 => now - 90 * 86_400,
            WindowPeriod::D200 => now - 200 * 86_400,
            WindowPeriod::Y1 => now - 365 * 86_400,
            WindowPeriod::Ytd => {
                let dt = Utc.timestamp_opt(now, 0).single().unwrap_or_else(Utc::now);
                Utc.with_ymd_and_hms(dt.year(), 1, 1, 0, 0, 0)
                    .single()
                    .map(|d| d.timestamp())
                    .unwrap_or(now)
            }
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            WindowPeriod::H1 => "1h",
            WindowPeriod::H24 => "24h",
            WindowPeriod::D7 => "7 dias",
            WindowPeriod::D14 => "14 dias",
            WindowPeriod::D30 => "30 dias",
            WindowPeriod::D90 => "90 dias",
            WindowPeriod::D200 => "200 dias",
            WindowPeriod::Y1 => "1 ano",
            WindowPeriod::Ytd => "ano atual",
        }
    }

    pub fn order(&self) -> u8 {
        match self {
            WindowPeriod::H1 => 0,
            WindowPeriod::H24 => 1,
            WindowPeriod::D7 => 2,
            WindowPeriod::D14 => 3,
            WindowPeriod::D30 => 4,
            WindowPeriod::D90 => 5,
            WindowPeriod::D200 => 6,
            WindowPeriod::Y1 => 7,
            WindowPeriod::Ytd => 8,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WindowDirection {
    Min,
    Max,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PriceDirection {
    Above,
    Below,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum PurchaseTrigger {
    Window {
        window: WindowPeriod,
        direction: WindowDirection,
    },
    Price {
        target: f64,
        direction: PriceDirection,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BestPurchaseWindowEntry {
    pub asset_key: String,
    pub symbol: String,
    pub coingecko_id: String,
    pub protocol: AllocationProtocol,
    pub chain: AllocationChain,
    pub token: AllocationToken,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger: Option<PurchaseTrigger>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub triggers: Vec<PurchaseTrigger>,
}

impl BestPurchaseWindowEntry {
    pub fn effective_triggers(&self) -> Vec<PurchaseTrigger> {
        if !self.triggers.is_empty() {
            self.triggers.clone()
        } else if let Some(t) = &self.trigger {
            vec![t.clone()]
        } else {
            Vec::new()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenMarketData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub market_cap: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub market_cap_rank: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fully_diluted_valuation: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_volume: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub high_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub low_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_1h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_7d: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_14d: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_30d: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_200d: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_1y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_change_percentage_ytd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub market_cap_change_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub market_cap_change_percentage_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub circulating_supply: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_supply: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_supply: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ath: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ath_change_percentage: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ath_date: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub atl: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub atl_change_percentage: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub atl_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerEvaluation {
    pub trigger: PurchaseTrigger,
    pub reference_price: f64,
    pub reference_label: String,
    pub signal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseWindowEvalResult {
    pub asset_key: String,
    pub symbol: String,
    pub current_price_usd: f64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub trigger: Option<PurchaseTrigger>,
    pub signal: bool,
    pub reference_price: f64,
    pub reference_label: String,
    #[serde(default)]
    pub evaluations: Vec<TriggerEvaluation>,
    pub fetched_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub market_data: Option<TokenMarketData>,
    #[serde(default)]
    pub data_unavailable: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocationProtocol {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing, default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocationChain {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing, default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocationToken {
    pub symbol: String,
    pub name: String,
    pub address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyAllocation {
    pub asset_key: String,
    pub protocol: AllocationProtocol,
    pub chain: AllocationChain,
    pub token: AllocationToken,
    pub group: String,
    pub group_type: i32,
    pub target_weight: i32,
    pub position_type: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthFactorTarget {
    pub asset_key: String,
    pub protocol: AllocationProtocol,
    pub chain: AllocationChain,
    pub target_health_factor: f64,
    pub critical_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyDocument {
    #[serde(
        serialize_with = "serialize_uuid",
        deserialize_with = "deserialize_uuid"
    )]
    pub id: Uuid,
    pub strategy_type: StrategyType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allocations: Option<Vec<StrategyAllocation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub targets: Option<Vec<HealthFactorTarget>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub purchase_window_entries: Option<Vec<BestPurchaseWindowEntry>>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub purchase_window_results: Option<Vec<PurchaseWindowEvalResult>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletGroupStrategies {
    #[serde(
        rename = "_id",
        serialize_with = "serialize_uuid",
        deserialize_with = "deserialize_uuid"
    )]
    pub wallet_group_id: Uuid,
    #[serde(alias = "accounts")]
    pub wallets: Vec<String>,
    pub strategies: Vec<StrategyDocument>,
    pub count: usize,
    pub key: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl WalletGroupStrategies {
    pub fn new(
        wallet_group_id: Uuid,
        wallets: Vec<String>,
        strategies: Vec<StrategyDocument>,
    ) -> Self {
        let now = Utc::now();
        let count = strategies.len();
        let key = wallet_group_id.to_string();

        Self {
            wallet_group_id,
            wallets,
            strategies,
            count,
            key,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletGroupStrategiesResponse {
    pub wallet_group_id: Uuid,
    pub wallets: Vec<String>,
    pub strategies: Vec<StrategyDocument>,
    pub count: usize,
    pub key: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<WalletGroupStrategies> for WalletGroupStrategiesResponse {
    fn from(wgs: WalletGroupStrategies) -> Self {
        Self {
            wallet_group_id: wgs.wallet_group_id,
            wallets: wgs.wallets,
            strategies: wgs.strategies,
            count: wgs.count,
            key: wgs.key,
            created_at: wgs.created_at,
            updated_at: wgs.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Uuid>,
    pub strategy_type: StrategyType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allocations: Option<Vec<StrategyAllocation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub targets: Option<Vec<HealthFactorTarget>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purchase_window_entries: Option<Vec<BestPurchaseWindowEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStrategiesRequest {
    pub wallet_group_id: String,
    pub strategies: Vec<StrategyRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategySummary {
    pub id: Uuid,
    pub strategy_type: i32,
    pub name: Option<String>,
    pub allocations_count: usize,
    pub targets_count: usize,
    pub purchase_window_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStrategiesResponse {
    pub key: String,
    pub strategies_count: usize,
    pub strategies: Vec<StrategySummary>,
    pub wallets: Vec<String>,
    pub saved_at: DateTime<Utc>,
}
