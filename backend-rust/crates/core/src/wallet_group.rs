use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Wallet Group - A collection of wallet addresses grouped together
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletGroup {
    #[serde(rename = "_id")]
    #[serde(
        serialize_with = "serialize_uuid",
        deserialize_with = "deserialize_uuid"
    )]
    pub id: Uuid,
    #[serde(alias = "accounts")]
    pub wallets: Vec<String>,
    pub display_name: Option<String>,
    pub user_id: Option<String>,
    pub version: Option<i32>,
    pub password_hash: Option<String>,
    pub is_deleted: Option<bool>,
    #[serde(deserialize_with = "deserialize_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(deserialize_with = "deserialize_datetime")]
    pub updated_at: DateTime<Utc>,
}

// Helper functions for UUID serialization with MongoDB
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

// Helper function to deserialize DateTime from C# MongoDB format
fn deserialize_datetime<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error;

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum DateTimeFormat {
        // RFC 3339 string format
        String(String),
        // MongoDB C# driver format: { "$date": "2021-01-01T00:00:00Z" } or { "$date": { "$numberLong": "1609459200000" } }
        BsonDateTime {
            #[serde(rename = "$date")]
            date: BsonDate,
        },
    }

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum BsonDate {
        String(String),
        NumberLong {
            #[serde(rename = "$numberLong")]
            number_long: String,
        },
        I64(i64),
    }

    let date_format = DateTimeFormat::deserialize(deserializer)?;

    match date_format {
        DateTimeFormat::String(s) => DateTime::parse_from_rfc3339(&s)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(Error::custom),
        DateTimeFormat::BsonDateTime { date } => match date {
            BsonDate::String(s) => DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(Error::custom),
            BsonDate::NumberLong { number_long } => {
                let millis: i64 = number_long.parse().map_err(Error::custom)?;
                DateTime::from_timestamp_millis(millis)
                    .ok_or_else(|| Error::custom("Invalid timestamp"))
            }
            BsonDate::I64(millis) => DateTime::from_timestamp_millis(millis)
                .ok_or_else(|| Error::custom("Invalid timestamp")),
        },
    }
}

impl WalletGroup {
    pub fn new(
        display_name: Option<String>,
        wallets: Vec<String>,
        user_id: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            wallets,
            display_name,
            user_id,
            version: Some(1),
            password_hash: None,
            is_deleted: Some(false),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn update(&mut self, display_name: Option<String>, wallets: Option<Vec<String>>) {
        if let Some(n) = display_name {
            self.display_name = Some(n);
        }
        if let Some(w) = wallets {
            self.wallets = w;
        }
        self.updated_at = Utc::now();
    }
}

/// Request to create a wallet group
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWalletGroupRequest {
    pub display_name: Option<String>,
    pub wallets: Vec<String>,
}

/// Request to update a wallet group
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWalletGroupRequest {
    pub display_name: Option<String>,
    pub wallets: Option<Vec<String>>,
}

/// Response for wallet group operations
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletGroupResponse {
    pub id: Uuid,
    pub display_name: Option<String>,
    pub wallets: Vec<String>,
    pub has_password: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<WalletGroup> for WalletGroupResponse {
    fn from(group: WalletGroup) -> Self {
        Self {
            id: group.id,
            display_name: group.display_name,
            wallets: group.wallets,
            has_password: group.password_hash.is_some(),
            created_at: group.created_at,
            updated_at: group.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectRequest {
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResponse {
    pub token: String,
    pub wallet_group_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub wallets: Vec<String>,
    pub display_name: Option<String>,
    pub has_password: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_wallet_group() {
        let wallets = vec!["0x123".to_string(), "0x456".to_string()];
        let group = WalletGroup::new(
            Some("My Wallets".to_string()),
            wallets.clone(),
            Some("user123".to_string()),
        );

        assert_eq!(group.display_name, Some("My Wallets".to_string()));
        assert_eq!(group.wallets, wallets);
        assert_eq!(group.user_id, Some("user123".to_string()));
    }

    #[test]
    fn test_update_wallet_group() {
        let mut group = WalletGroup::new(
            Some("My Wallets".to_string()),
            vec!["0x123".to_string()],
            None,
        );

        let old_updated_at = group.updated_at;
        std::thread::sleep(std::time::Duration::from_millis(10));

        group.update(
            Some("Updated Name".to_string()),
            Some(vec!["0x123".to_string(), "0x789".to_string()]),
        );

        assert_eq!(group.display_name, Some("Updated Name".to_string()));
        assert_eq!(group.wallets.len(), 2);
        assert!(group.updated_at > old_updated_at);
    }
}
