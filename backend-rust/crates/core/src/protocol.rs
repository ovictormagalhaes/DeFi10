use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Protocol {
    #[serde(rename = "aave-v3")]
    AaveV3,
    #[serde(rename = "uniswap-v3")]
    UniswapV3,
    Kamino,
    Raydium,
    Pendle,
    Moralis,
}

impl Protocol {
    pub fn all() -> Vec<Protocol> {
        vec![
            Protocol::AaveV3,
            Protocol::UniswapV3,
            Protocol::Kamino,
            Protocol::Raydium,
            Protocol::Pendle,
            Protocol::Moralis,
        ]
    }

    pub fn key(&self) -> &'static str {
        match self {
            Protocol::AaveV3 => "aave-v3",
            Protocol::UniswapV3 => "uniswap-v3",
            Protocol::Kamino => "kamino",
            Protocol::Raydium => "raydium",
            Protocol::Pendle => "pendle",
            Protocol::Moralis => "moralis",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Protocol::AaveV3 => "Aave V3",
            Protocol::UniswapV3 => "Uniswap V3",
            Protocol::Kamino => "Kamino",
            Protocol::Raydium => "Raydium",
            Protocol::Pendle => "Pendle",
            Protocol::Moralis => "Wallet",
        }
    }

    pub fn icon_url(&self) -> &'static str {
        match self {
            Protocol::AaveV3 => "https://cdn.moralis.io/defi/aave.png",
            Protocol::UniswapV3 => "https://cdn.moralis.io/defi/uniswap.png",
            Protocol::Kamino => "https://app.kamino.finance/favicon.ico",
            Protocol::Raydium => "https://raydium.io/logo/logo-text.svg",
            Protocol::Pendle => "https://pendle.finance/favicon.ico",
            Protocol::Moralis => "https://moralis.com/wp-content/uploads/web3wiki/840-moralis/637b68b19fa9435d888c9cf0_aY-cSH39nYSEEvIN-9hCed-2B5ISs9a4epw2oiGlKMI.jpeg",
        }
    }

    pub fn website(&self) -> &'static str {
        match self {
            Protocol::AaveV3 => "https://app.aave.com",
            Protocol::UniswapV3 => "https://app.uniswap.org",
            Protocol::Kamino => "https://app.kamino.finance",
            Protocol::Raydium => "https://raydium.io",
            Protocol::Pendle => "https://pendle.finance",
            Protocol::Moralis => "https://moralis.io",
        }
    }

    pub fn documentation(&self) -> Option<&'static str> {
        match self {
            Protocol::AaveV3 => Some("https://docs.aave.com"),
            Protocol::UniswapV3 => Some("https://docs.uniswap.org"),
            Protocol::Kamino => Some("https://docs.kamino.finance"),
            Protocol::Raydium => Some("https://docs.raydium.io"),
            Protocol::Pendle => Some("https://docs.pendle.finance"),
            Protocol::Moralis => None,
        }
    }
}

impl fmt::Display for Protocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

impl FromStr for Protocol {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "aave-v3" | "aave" | "aavev3" => Ok(Protocol::AaveV3),
            "uniswap-v3" | "uniswap" | "uniswapv3" => Ok(Protocol::UniswapV3),
            "kamino" => Ok(Protocol::Kamino),
            "raydium" => Ok(Protocol::Raydium),
            "pendle" => Ok(Protocol::Pendle),
            "moralis" | "wallet" => Ok(Protocol::Moralis),
            _ => Err(format!("Unknown protocol: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_all() {
        let protocols = Protocol::all();
        assert_eq!(protocols.len(), 6);
        assert!(protocols.contains(&Protocol::AaveV3));
        assert!(protocols.contains(&Protocol::Kamino));
    }

    #[test]
    fn test_protocol_key() {
        assert_eq!(Protocol::AaveV3.key(), "aave-v3");
        assert_eq!(Protocol::UniswapV3.key(), "uniswap-v3");
        assert_eq!(Protocol::Kamino.key(), "kamino");
    }

    #[test]
    fn test_display_name() {
        assert_eq!(Protocol::AaveV3.display_name(), "Aave V3");
        assert_eq!(Protocol::Moralis.display_name(), "Wallet");
    }

    #[test]
    fn test_display_trait() {
        assert_eq!(format!("{}", Protocol::AaveV3), "Aave V3");
        assert_eq!(format!("{}", Protocol::Kamino), "Kamino");
    }

    #[test]
    fn test_from_str() {
        assert_eq!("aave-v3".parse::<Protocol>().unwrap(), Protocol::AaveV3);
        assert_eq!("aave".parse::<Protocol>().unwrap(), Protocol::AaveV3);
        assert_eq!(
            "uniswap-v3".parse::<Protocol>().unwrap(),
            Protocol::UniswapV3
        );
        assert_eq!("kamino".parse::<Protocol>().unwrap(), Protocol::Kamino);
        assert_eq!("RAYDIUM".parse::<Protocol>().unwrap(), Protocol::Raydium);
        assert_eq!("wallet".parse::<Protocol>().unwrap(), Protocol::Moralis);

        assert!("invalid".parse::<Protocol>().is_err());
    }

    #[test]
    fn test_website() {
        assert_eq!(Protocol::AaveV3.website(), "https://app.aave.com");
        assert_eq!(Protocol::Kamino.website(), "https://app.kamino.finance");
    }

    #[test]
    fn test_documentation() {
        assert_eq!(
            Protocol::AaveV3.documentation(),
            Some("https://docs.aave.com")
        );
        assert_eq!(Protocol::Moralis.documentation(), None);
    }

    #[test]
    fn test_serde_serialization() {
        let protocol = Protocol::AaveV3;
        let json = serde_json::to_string(&protocol).unwrap();
        assert_eq!(json, r#""aave-v3""#);

        let protocol = Protocol::UniswapV3;
        let json = serde_json::to_string(&protocol).unwrap();
        assert_eq!(json, r#""uniswap-v3""#);
    }

    #[test]
    fn test_serde_deserialization() {
        let protocol: Protocol = serde_json::from_str(r#""aave-v3""#).unwrap();
        assert_eq!(protocol, Protocol::AaveV3);

        let protocol: Protocol = serde_json::from_str(r#""kamino""#).unwrap();
        assert_eq!(protocol, Protocol::Kamino);
    }

    #[test]
    fn test_hash_equality() {
        use std::collections::HashSet;

        let mut set = HashSet::new();
        set.insert(Protocol::AaveV3);
        set.insert(Protocol::AaveV3); // Duplicate
        set.insert(Protocol::Kamino);

        assert_eq!(set.len(), 2);
        assert!(set.contains(&Protocol::AaveV3));
        assert!(set.contains(&Protocol::Kamino));
    }
}
