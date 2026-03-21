use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Ethereum,
    Base,
    Polygon,
    Arbitrum,
    Optimism,
    #[serde(rename = "bnb")]
    BNB,
    Solana,
}

impl Chain {
    pub fn all() -> Vec<Chain> {
        vec![
            Chain::Ethereum,
            Chain::Base,
            Chain::Polygon,
            Chain::Arbitrum,
            Chain::Optimism,
            Chain::BNB,
            Chain::Solana,
        ]
    }

    pub fn is_evm(&self) -> bool {
        matches!(
            self,
            Chain::Ethereum
                | Chain::Base
                | Chain::Polygon
                | Chain::Arbitrum
                | Chain::Optimism
                | Chain::BNB
        )
    }

    pub fn is_solana(&self) -> bool {
        matches!(self, Chain::Solana)
    }

    pub fn chain_id(&self) -> Option<u64> {
        match self {
            Chain::Ethereum => Some(1),
            Chain::Base => Some(8453),
            Chain::Polygon => Some(137),
            Chain::Arbitrum => Some(42161),
            Chain::Optimism => Some(10),
            Chain::BNB => Some(56),
            Chain::Solana => None,
        }
    }

    pub fn slug(&self) -> &'static str {
        match self {
            Chain::Ethereum => "ethereum",
            Chain::Base => "base",
            Chain::Polygon => "polygon",
            Chain::Arbitrum => "arbitrum",
            Chain::Optimism => "optimism",
            Chain::BNB => "bnb",
            Chain::Solana => "solana",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Chain::Ethereum => "Ethereum",
            Chain::Base => "Base",
            Chain::Polygon => "Polygon",
            Chain::Arbitrum => "Arbitrum",
            Chain::Optimism => "Optimism",
            Chain::BNB => "BNB Chain",
            Chain::Solana => "Solana",
        }
    }

    pub fn icon_url(&self) -> &'static str {
        match self {
            Chain::Ethereum => "https://cryptologos.cc/logos/ethereum-eth-logo.png",
            Chain::Base => "https://avatars.githubusercontent.com/u/108554348",
            Chain::Polygon => "https://cryptologos.cc/logos/polygon-matic-logo.png",
            Chain::Arbitrum => "https://cryptologos.cc/logos/arbitrum-arb-logo.png",
            Chain::Optimism => "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png",
            Chain::BNB => "https://cryptologos.cc/logos/bnb-bnb-logo.png",
            Chain::Solana => "https://cryptologos.cc/logos/solana-sol-logo.png",
        }
    }
}

impl fmt::Display for Chain {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

impl FromStr for Chain {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "ethereum" | "eth" => Ok(Chain::Ethereum),
            "base" => Ok(Chain::Base),
            "polygon" | "matic" => Ok(Chain::Polygon),
            "arbitrum" | "arb" => Ok(Chain::Arbitrum),
            "optimism" | "op" => Ok(Chain::Optimism),
            "bnb" | "bsc" | "binance" => Ok(Chain::BNB),
            "solana" | "sol" => Ok(Chain::Solana),
            _ => Err(format!("Unknown chain: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_all() {
        let chains = Chain::all();
        assert_eq!(chains.len(), 7);
        assert!(chains.contains(&Chain::Ethereum));
        assert!(chains.contains(&Chain::Solana));
    }

    #[test]
    fn test_is_evm() {
        assert!(Chain::Ethereum.is_evm());
        assert!(Chain::Base.is_evm());
        assert!(Chain::Arbitrum.is_evm());
        assert!(Chain::BNB.is_evm());
        assert!(!Chain::Solana.is_evm());
    }

    #[test]
    fn test_is_solana() {
        assert!(!Chain::Ethereum.is_solana());
        assert!(Chain::Solana.is_solana());
    }

    #[test]
    fn test_chain_id() {
        assert_eq!(Chain::Ethereum.chain_id(), Some(1));
        assert_eq!(Chain::Base.chain_id(), Some(8453));
        assert_eq!(Chain::Arbitrum.chain_id(), Some(42161));
        assert_eq!(Chain::BNB.chain_id(), Some(56));
        assert_eq!(Chain::Solana.chain_id(), None);
    }

    #[test]
    fn test_slug() {
        assert_eq!(Chain::Ethereum.slug(), "ethereum");
        assert_eq!(Chain::Base.slug(), "base");
        assert_eq!(Chain::BNB.slug(), "bnb");
    }

    #[test]
    fn test_display_name() {
        assert_eq!(Chain::Ethereum.display_name(), "Ethereum");
        assert_eq!(Chain::BNB.display_name(), "BNB Chain");
    }

    #[test]
    fn test_display_trait() {
        assert_eq!(format!("{}", Chain::Ethereum), "Ethereum");
        assert_eq!(format!("{}", Chain::Solana), "Solana");
    }

    #[test]
    fn test_from_str() {
        assert_eq!("ethereum".parse::<Chain>().unwrap(), Chain::Ethereum);
        assert_eq!("ETH".parse::<Chain>().unwrap(), Chain::Ethereum);
        assert_eq!("base".parse::<Chain>().unwrap(), Chain::Base);
        assert_eq!("bnb".parse::<Chain>().unwrap(), Chain::BNB);
        assert_eq!("bsc".parse::<Chain>().unwrap(), Chain::BNB);
        assert_eq!("solana".parse::<Chain>().unwrap(), Chain::Solana);
        assert_eq!("SOL".parse::<Chain>().unwrap(), Chain::Solana);

        assert!("invalid".parse::<Chain>().is_err());
    }

    #[test]
    fn test_serde_serialization() {
        let chain = Chain::Ethereum;
        let json = serde_json::to_string(&chain).unwrap();
        assert_eq!(json, r#""ethereum""#);

        let chain = Chain::BNB;
        let json = serde_json::to_string(&chain).unwrap();
        assert_eq!(json, r#""bnb""#);
    }

    #[test]
    fn test_serde_deserialization() {
        let chain: Chain = serde_json::from_str(r#""ethereum""#).unwrap();
        assert_eq!(chain, Chain::Ethereum);

        let chain: Chain = serde_json::from_str(r#""bnb""#).unwrap();
        assert_eq!(chain, Chain::BNB);

        let chain: Chain = serde_json::from_str(r#""solana""#).unwrap();
        assert_eq!(chain, Chain::Solana);
    }

    #[test]
    fn test_hash_equality() {
        use std::collections::HashSet;

        let mut set = HashSet::new();
        set.insert(Chain::Ethereum);
        set.insert(Chain::Ethereum); // Duplicate
        set.insert(Chain::Base);

        assert_eq!(set.len(), 2);
        assert!(set.contains(&Chain::Ethereum));
        assert!(set.contains(&Chain::Base));
    }
}
