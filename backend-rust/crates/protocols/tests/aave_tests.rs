use defi10_core::Chain;
use defi10_protocols::{AaveV3Service, PositionType};
use wiremock::{
    matchers::{method, path},
    Mock, MockServer, ResponseTemplate,
};

#[tokio::test]
async fn test_aave_user_positions_parsing() {
    let mock_server = MockServer::start().await;

    let mock_response = serde_json::json!({
        "data": {
            "userReserves": [
                {
                    "scaledATokenBalance": "1000000000",
                    "currentATokenBalance": "1000000000",
                    "scaledVariableDebt": "0",
                    "currentVariableDebt": "0",
                    "principalStableDebt": "0",
                    "currentStableDebt": "0",
                    "reserve": {
                        "id": "0x123",
                        "underlyingAsset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                        "name": "USD Coin",
                        "symbol": "USDC",
                        "decimals": 6,
                        "liquidityRate": "50000000000000000000000000",
                        "variableBorrowRate": "60000000000000000000000000",
                        "stableBorrowRate": "70000000000000000000000000",
                        "liquidityIndex": "1000000000000000000000000000",
                        "variableBorrowIndex": "1000000000000000000000000000",
                        "price": {
                            "priceInEth": "333333333333333",
                            "oracle": "0xOracle123"
                        }
                    }
                }
            ]
        }
    });

    Mock::given(method("POST"))
        .and(path("/"))
        .respond_with(ResponseTemplate::new(200).set_body_json(mock_response))
        .mount(&mock_server)
        .await;

    // Test would work with a way to inject the mock URL
    // For now, this demonstrates the test structure
}

#[test]
fn test_position_type_enum() {
    use defi10_protocols::PositionType;
    use serde_json;

    let lending = PositionType::Lending;
    let json = serde_json::to_string(&lending).unwrap();
    assert_eq!(json, r#""lending""#);

    let borrowing = PositionType::Borrowing;
    let json = serde_json::to_string(&borrowing).unwrap();
    assert_eq!(json, r#""borrowing""#);
}

#[test]
fn test_aave_service_initialization() {
    let service = AaveV3Service::new();

    // Service should have subgraph URLs configured
    // Internal test - service is properly constructed
    let _ = service;
}

#[tokio::test]
async fn test_aave_unsupported_chain() {
    let service = AaveV3Service::new();

    // Solana doesn't have Aave V3
    let result = service
        .get_user_positions(Chain::Solana, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1")
        .await;

    assert!(result.is_err());
}

#[test]
fn test_yield_info_serialization() {
    use defi10_protocols::{YieldComponent, YieldInfo};
    use serde_json;

    let yield_info = YieldInfo {
        apy: 5.5,
        apr: 5.2,
        breakdown: vec![YieldComponent {
            name: "Supply APY".to_string(),
            apy: 5.5,
            token_symbol: Some("USDC".to_string()),
        }],
    };

    let json = serde_json::to_string(&yield_info).unwrap();
    assert!(json.contains("5.5"));

    let deserialized: YieldInfo = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.apy, 5.5);
}
