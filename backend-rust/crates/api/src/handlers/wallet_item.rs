use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletItem {
    #[serde(rename = "type")]
    pub item_type: WalletItemType,
    pub protocol: ProtocolInfo,
    pub position: Position,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additional_data: Option<AdditionalData>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum WalletItemType {
    Unknown = 0,
    Wallet = 1,
    LiquidityPool = 2,
    LendingAndBorrowing = 3,
    Staking = 4,
    Token = 5,
    Locking = 6,
    Depositing = 7,
    Other = 50,
}

impl WalletItemType {
    pub fn from_position_type(position_type: &str) -> Self {
        match position_type.to_lowercase().as_str() {
            "wallet" => WalletItemType::Wallet,
            "lending" | "borrowing" | "lendingandborowing" => WalletItemType::LendingAndBorrowing,
            "liquiditypool" | "liquidity_pool" => WalletItemType::LiquidityPool,
            "staking" => WalletItemType::Staking,
            "locking" => WalletItemType::Locking,
            "depositing" | "yield" => WalletItemType::Depositing,
            _ => WalletItemType::Other,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolInfo {
    pub name: String,
    pub chain: String,
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
    pub key: String,
}

impl ProtocolInfo {
    pub fn new(name: &str, chain: &str, id: &str) -> Self {
        let key = format!(
            "{}-{}-{}",
            name.to_lowercase(),
            chain.to_lowercase(),
            id.to_lowercase()
        );
        Self {
            name: name.to_string(),
            chain: chain.to_string(),
            id: id.to_string(),
            url: None,
            logo: None,
            key,
        }
    }

    pub fn wallet(chain: &str) -> Self {
        Self {
            name: "Wallet".to_string(),
            chain: chain.to_string(),
            id: "moralis".to_string(),
            url: Some("https://moralis.io".to_string()),
            logo: Some("https://moralis.com/wp-content/uploads/web3wiki/840-moralis/637b68b19fa9435d888c9cf0_aY-cSH39nYSEEvIN-9hCed-2B5ISs9a4epw2oiGlKMI.jpeg".to_string()),
            key: format!("wallet-{}-moralis", chain.to_lowercase()),
        }
    }

    pub fn aave_v3(chain: &str) -> Self {
        Self {
            name: "Aave V3".to_string(),
            chain: chain.to_string(),
            id: "aave-v3".to_string(),
            url: Some("https://app.aave.com".to_string()),
            logo: Some("https://cdn.moralis.io/defi/aave.png".to_string()),
            key: format!("aave v3-{}-aave-v3", chain.to_lowercase()),
        }
    }

    pub fn uniswap_v3(chain: &str) -> Self {
        Self {
            name: "Uniswap V3".to_string(),
            chain: chain.to_string(),
            id: "uniswap-v3".to_string(),
            url: Some("https://app.uniswap.org".to_string()),
            logo: Some("https://cdn.moralis.io/defi/uniswap.png".to_string()),
            key: format!("uniswap v3-{}-uniswap-v3", chain.to_lowercase()),
        }
    }

    pub fn raydium(chain: &str) -> Self {
        Self {
            name: "Raydium".to_string(),
            chain: chain.to_string(),
            id: "raydium".to_string(),
            url: Some("https://raydium.io".to_string()),
            logo: Some("https://raydium.io/logo.png".to_string()),
            key: format!("raydium-{}-raydium", chain.to_lowercase()),
        }
    }

    pub fn kamino(chain: &str) -> Self {
        Self {
            name: "Kamino".to_string(),
            chain: chain.to_string(),
            id: "kamino".to_string(),
            url: Some("https://app.kamino.finance".to_string()),
            logo: Some("https://app.kamino.finance/favicon.ico".to_string()),
            key: format!("kamino-{}-kamino", chain.to_lowercase()),
        }
    }

    pub fn pendle(chain: &str) -> Self {
        Self {
            name: "Pendle V2".to_string(),
            chain: chain.to_string(),
            id: "pendle-v2".to_string(),
            url: Some("https://app.pendle.finance".to_string()),
            logo: Some("https://logo.moralis.io/0xa4b1_0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8_0270cab3e068234013aa17f290e4b6cb.png".to_string()),
            key: format!("pendle v2-{}-pendle-v2", chain.to_lowercase()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub label: String,
    pub tokens: Vec<Token>,
    pub key: String,
}

impl Position {
    pub fn new(label: &str, tokens: Vec<Token>) -> Self {
        Self {
            label: label.to_string(),
            tokens,
            key: label.to_lowercase(),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TokenType {
    Supplied = 1,
    Borrowed = 2,
    LiquidityUncollectedFee = 3,
    LiquidityCollectedFee = 4,
    GovernancePower = 5,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Token {
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub token_type: Option<TokenType>,
    pub name: String,
    pub chain: String,
    pub symbol: String,
    pub contract_address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    pub financials: TokenFinancials,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub possible_spam: Option<bool>,
    pub key: String,
}

impl Token {
    pub fn new(
        symbol: &str,
        name: &str,
        chain: &str,
        contract_address: &str,
        financials: TokenFinancials,
    ) -> Self {
        let key = format!(
            "-{}-{}-{}",
            symbol.to_lowercase(),
            name.to_lowercase(),
            chain.to_lowercase()
        );
        Self {
            token_type: None,
            name: name.to_string(),
            chain: chain.to_string(),
            symbol: symbol.to_string(),
            contract_address: contract_address.to_string(),
            logo: None,
            thumbnail: None,
            financials,
            native: None,
            possible_spam: None,
            key,
        }
    }

    pub fn with_type(mut self, token_type: TokenType) -> Self {
        self.token_type = Some(token_type);
        self.key = format!(
            "{}-{}-{}-{}",
            token_type_to_string(token_type),
            self.symbol.to_lowercase(),
            self.name.to_lowercase(),
            self.chain.to_lowercase()
        );
        self
    }
}

fn token_type_to_string(t: TokenType) -> &'static str {
    match t {
        TokenType::Supplied => "supplied",
        TokenType::Borrowed => "borrowed",
        TokenType::LiquidityUncollectedFee => "liquidityuncollectedfee",
        TokenType::LiquidityCollectedFee => "liquiditycollectedfee",
        TokenType::GovernancePower => "governancepower",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenFinancials {
    pub amount: f64,
    pub decimal_places: u8,
    pub amount_formatted: f64,
    pub balance_formatted: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_price: Option<f64>,
}

impl TokenFinancials {
    pub fn new(raw_amount: f64, decimals: u8, price: Option<f64>) -> Self {
        let divisor = 10f64.powi(decimals as i32);
        let formatted = raw_amount / divisor;
        let total = price.map(|p| formatted * p);

        Self {
            amount: formatted,
            decimal_places: decimals,
            amount_formatted: formatted,
            balance_formatted: formatted,
            price,
            total_price: total,
        }
    }

    pub fn from_formatted(formatted: f64, decimals: u8, price: Option<f64>) -> Self {
        let total = price.map(|p| formatted * p);

        Self {
            amount: formatted,
            decimal_places: decimals,
            amount_formatted: formatted,
            balance_formatted: formatted,
            price,
            total_price: total,
        }
    }

    pub fn from_raw_string(raw_balance: &str, decimals: u8, price: Option<f64>) -> Self {
        let raw = raw_balance.parse::<f64>().unwrap_or(0.0);
        let divisor = 10f64.powi(decimals as i32);
        let formatted = raw / divisor;
        let total = price.map(|p| formatted * p);

        Self {
            amount: formatted,
            decimal_places: decimals,
            amount_formatted: formatted,
            balance_formatted: formatted,
            price,
            total_price: total,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdditionalData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_factor: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_collateral: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_be_collateral: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tick_spacing: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sqrt_price_x96: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unlock_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_unavailable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fees_24h: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_value_usd: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apr: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apr_historical: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projections: Option<Vec<ProjectionData>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range: Option<RangeInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplies: Option<Vec<SupplyItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub borrows: Option<Vec<BorrowItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repays: Option<Vec<RepayItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supplies_tokens: Option<Vec<TokenInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub borrows_tokens: Option<Vec<TokenInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repays_tokens: Option<Vec<TokenInfo>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RangeInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upper: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lower: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_range: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range_size: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionData {
    #[serde(rename = "type")]
    pub projection_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_type: Option<String>,
    pub projection: Projection,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Projection {
    pub one_day: f64,
    pub one_week: f64,
    pub one_month: f64,
    pub one_year: f64,
}

impl Projection {
    pub fn from_apy(apy_percent: f64, value_usd: f64) -> Self {
        let daily_rate = apy_percent / 100.0 / 365.0;
        Self {
            one_day: value_usd * daily_rate,
            one_week: value_usd * daily_rate * 7.0,
            one_month: value_usd * daily_rate * 30.0,
            one_year: value_usd * apy_percent / 100.0,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplyItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mint_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BorrowItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mint_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepayItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mint_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mint_address: Option<String>,
    pub symbol: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,
    pub decimals: u8,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_financials_from_raw_string_8_decimals() {
        let financials = TokenFinancials::from_raw_string("39302104", 8, Some(72000.0));

        assert!((financials.amount - 0.39302104).abs() < 0.0000001);
        assert!((financials.amount_formatted - 0.39302104).abs() < 0.0000001);
        assert!((financials.balance_formatted - 0.39302104).abs() < 0.0000001);
        assert_eq!(financials.decimal_places, 8);
        assert_eq!(financials.price, Some(72000.0));

        let total = financials.total_price.unwrap();
        assert!((total - 28297.51488).abs() < 0.01);
    }

    #[test]
    fn test_token_financials_from_raw_string_18_decimals() {
        let balance_raw = "4806877529142606000";
        let financials = TokenFinancials::from_raw_string(balance_raw, 18, Some(2137.0));

        assert!((financials.amount - 4.806877529142606).abs() < 0.0000001);
        assert!((financials.amount_formatted - 4.806877529142606).abs() < 0.0000001);
        assert_eq!(financials.decimal_places, 18);
    }

    #[test]
    fn test_token_financials_from_raw_string_6_decimals() {
        let financials = TokenFinancials::from_raw_string("14998913319", 6, Some(1.0));

        assert!((financials.amount - 14998.913319).abs() < 0.000001);
        assert!((financials.amount_formatted - 14998.913319).abs() < 0.000001);
        assert_eq!(financials.decimal_places, 6);
    }

    #[test]
    fn test_token_financials_amount_equals_formatted() {
        let raw_balance = "1000000000000000000";
        let financials = TokenFinancials::from_raw_string(raw_balance, 18, None);

        assert_eq!(financials.amount, financials.amount_formatted);
        assert_eq!(financials.amount, financials.balance_formatted);
        assert!((financials.amount - 1.0).abs() < 0.0000001);
    }

    #[test]
    fn test_token_financials_serialization() {
        let financials = TokenFinancials::from_raw_string("100000000", 8, Some(50000.0));
        let json = serde_json::to_string(&financials).unwrap();

        assert!(json.contains("\"amount\":1.0"));
        assert!(json.contains("\"amountFormatted\":1.0"));
        assert!(json.contains("\"decimalPlaces\":8"));
        assert!(json.contains("\"price\":50000.0"));
    }
}
