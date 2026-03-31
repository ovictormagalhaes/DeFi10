use chrono::{DateTime, Utc};
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
    Uuid::parse_str(&s).map_err(serde::de::Error::custom)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize_repr, Deserialize_repr)]
#[repr(i32)]
pub enum StrategyType {
    AllocationByWeight = 1,
    HealthFactorTarget = 2,
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
