use crate::{middleware::ApiResult, state::AppState};
use axum::{extract::State, Json};
use defi10_core::Chain;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct SupportedChainsResponse {
    pub chains: Vec<ChainInfo>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChainInfo {
    pub name: String,
    pub id: String,
    pub chain_id: Option<u64>,
    pub display_name: String,
    pub icon_url: String,
}

pub async fn get_supported_chains(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<Json<SupportedChainsResponse>> {
    let chains: Vec<ChainInfo> = Chain::all()
        .into_iter()
        .map(|chain| ChainInfo {
            name: chain.to_string(),
            id: chain.slug().to_string(),
            chain_id: chain.chain_id(),
            display_name: chain.display_name().to_string(),
            icon_url: chain.icon_url().to_string(),
        })
        .collect();

    let response = SupportedChainsResponse {
        chains,
        last_updated: chrono::Utc::now(),
    };

    Ok(Json(response))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_info_from_chain() {
        let chain = Chain::Ethereum;
        let info = ChainInfo {
            name: chain.to_string(),
            id: chain.slug().to_string(),
            chain_id: chain.chain_id(),
            display_name: chain.display_name().to_string(),
            icon_url: chain.icon_url().to_string(),
        };

        assert_eq!(info.name, "Ethereum");
        assert_eq!(info.id, "ethereum");
        assert_eq!(info.chain_id, Some(1));
        assert_eq!(info.display_name, "Ethereum");
    }

    #[test]
    fn test_supported_chains_response() {
        let chains = vec![
            ChainInfo {
                name: "Ethereum".to_string(),
                id: "ethereum".to_string(),
                chain_id: Some(1),
                display_name: "Ethereum".to_string(),
                icon_url: "https://example.com/eth.png".to_string(),
            },
            ChainInfo {
                name: "Solana".to_string(),
                id: "solana".to_string(),
                chain_id: None,
                display_name: "Solana".to_string(),
                icon_url: "https://example.com/sol.png".to_string(),
            },
        ];

        let response = SupportedChainsResponse {
            chains,
            last_updated: chrono::Utc::now(),
        };

        assert_eq!(response.chains.len(), 2);
        assert_eq!(response.chains[0].name, "Ethereum");
        assert_eq!(response.chains[1].name, "Solana");
    }

    #[test]
    fn test_chain_info_serialization() {
        let info = ChainInfo {
            name: "Base".to_string(),
            id: "base".to_string(),
            chain_id: Some(8453),
            display_name: "Base".to_string(),
            icon_url: "https://example.com/base.png".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"name\":\"Base\""));
        assert!(json.contains("\"chain_id\":8453"));
    }
}
