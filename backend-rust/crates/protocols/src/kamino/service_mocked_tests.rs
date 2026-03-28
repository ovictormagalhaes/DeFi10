use super::*;
use wiremock::matchers::{method, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn mock_obligation_response() -> serde_json::Value {
    serde_json::json!([{
        "obligationAddress": "52ujE123",
        "state": {
            "owner": "TestWallet",
            "lendingMarket": "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
            "deposits": [{
                "depositReserve": "reserve1",
                "depositedAmount": "1000000000",
                "marketValueSf": "5000"
            }],
            "borrows": [{
                "borrowReserve": "reserve2",
                "borrowedAmountSf": "500000000000000000000",
                "borrowedAmountOutsideElevationGroups": "500000000",
                "marketValueSf": "3000"
            }]
        },
        "refreshedStats": {
            "userTotalDeposit": "100.0",
            "userTotalBorrow": "50.0",
            "netAccountValue": "50.0",
            "loanToValue": "0.5"
        }
    }])
}

fn mock_reserves_response() -> serde_json::Value {
    serde_json::json!([
        {
            "reserve": "reserve1",
            "liquidityToken": "SOL",
            "liquidityTokenMint": "So11111111111111111111111111111111111111112",
            "supplyApy": "0.055",
            "borrowApy": "0.072",
            "totalSupply": "1000",
            "totalSupplyUsd": "100000",
            "totalBorrow": "500",
            "totalBorrowUsd": "50000"
        },
        {
            "reserve": "reserve2",
            "liquidityToken": "USDC",
            "liquidityTokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "supplyApy": "0.042",
            "borrowApy": "0.062",
            "totalSupply": "500000",
            "totalSupplyUsd": "500000",
            "totalBorrow": "250000",
            "totalBorrowUsd": "250000"
        }
    ])
}

async fn setup_mock_server(
    obligation_status: u16,
    obligation_body: Option<serde_json::Value>,
    reserves_body: Option<serde_json::Value>,
) -> MockServer {
    let mock_server = MockServer::start().await;

    let obligation_response = if let Some(body) = obligation_body {
        ResponseTemplate::new(obligation_status).set_body_json(body)
    } else {
        ResponseTemplate::new(obligation_status)
    };

    Mock::given(method("GET"))
        .and(path_regex(r"/kamino-market/.*/users/.*/obligations"))
        .respond_with(obligation_response)
        .mount(&mock_server)
        .await;

    if let Some(body) = reserves_body {
        Mock::given(method("GET"))
            .and(path_regex(r"/kamino-market/.*/reserves/metrics"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;
    }

    mock_server
}

#[tokio::test]
async fn test_get_user_positions_success() {
    let mock_server = setup_mock_server(
        200,
        Some(mock_obligation_response()),
        Some(mock_reserves_response()),
    )
    .await;

    let service = KaminoService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());

    let result = service.get_user_positions("TestWallet", provider).await;

    assert!(result.is_ok());
    let (positions, _market_data) = result.unwrap();
    assert_eq!(positions.len(), 2);

    let lending = positions.iter().find(|p| p.position_type == PositionType::Lending);
    assert!(lending.is_some());
    let lending = lending.unwrap();
    assert_eq!(lending.tokens[0].symbol, "SOL");
    assert_eq!(lending.tokens[0].decimals, 9);
    assert!(lending.tokens[0].price_usd > 0.0);
    assert!(lending.total_value_usd > 0.0);
    let sol_balance: f64 = lending.tokens[0].balance.parse().unwrap();
    assert!((sol_balance - 1.0).abs() < 0.001);

    let borrowing = positions.iter().find(|p| p.position_type == PositionType::Borrowing);
    assert!(borrowing.is_some());
    let borrowing = borrowing.unwrap();
    assert_eq!(borrowing.tokens[0].symbol, "USDC");
    assert_eq!(borrowing.tokens[0].decimals, 6);
    assert!(borrowing.tokens[0].price_usd > 0.0);
    let usdc_balance: f64 = borrowing.tokens[0].balance.parse().unwrap();
    assert!((usdc_balance - 500.0).abs() < 0.001);
}

#[tokio::test]
async fn test_get_user_positions_no_positions() {
    let mock_server = setup_mock_server(404, None, None).await;

    let service = KaminoService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());

    let result = service.get_user_positions("EmptyWallet", provider).await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().0.len(), 0);
}

#[tokio::test]
async fn test_get_user_positions_empty_obligations() {
    let mock_server = setup_mock_server(200, Some(serde_json::json!([])), None).await;

    let service = KaminoService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());

    let result = service.get_user_positions("Wallet", provider).await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().0.len(), 0);
}

#[tokio::test]
async fn test_get_user_positions_http_500() {
    let mock_server = setup_mock_server(500, None, None).await;

    let service = KaminoService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());

    let result = service.get_user_positions("Wallet", provider).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().0.len(), 0);
}

#[tokio::test]
async fn test_get_user_positions_only_deposits() {
    let body = serde_json::json!([{
        "obligationAddress": "obl1",
        "state": {
            "owner": "Wallet123",
            "lendingMarket": "market1",
            "deposits": [{
                "depositReserve": "reserve1",
                "depositedAmount": "10000000000",
                "marketValueSf": "8000"
            }],
            "borrows": []
        },
        "refreshedStats": {
            "userTotalDeposit": "1000.0",
            "userTotalBorrow": "0.0",
            "netAccountValue": "1000.0"
        }
    }]);

    let mock_server = setup_mock_server(200, Some(body), Some(mock_reserves_response())).await;

    let service = KaminoService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());

    let result = service.get_user_positions("Wallet123", provider).await;

    assert!(result.is_ok());
    let (positions, _market_data) = result.unwrap();
    assert!(positions.iter().all(|p| p.position_type == PositionType::Lending));
}

#[tokio::test]
async fn test_proportional_value_distribution() {
    let body = serde_json::json!([{
        "obligationAddress": "obl1",
        "state": {
            "owner": "Wallet",
            "lendingMarket": "market1",
            "deposits": [
                {
                    "depositReserve": "reserve1",
                    "depositedAmount": "5000000000",
                    "marketValueSf": "6000"
                },
                {
                    "depositReserve": "reserve2",
                    "depositedAmount": "1000000",
                    "marketValueSf": "4000"
                }
            ],
            "borrows": []
        },
        "refreshedStats": {
            "userTotalDeposit": "1000.0",
            "userTotalBorrow": "0.0",
            "netAccountValue": "1000.0"
        }
    }]);

    let mock_server = setup_mock_server(200, Some(body), Some(mock_reserves_response())).await;

    let service = KaminoService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());

    let result = service.get_user_positions("Wallet", provider).await;
    assert!(result.is_ok());
    let (positions, _market_data) = result.unwrap();
    assert_eq!(positions.len(), 2);

    let total: f64 = positions.iter().map(|p| p.total_value_usd).sum();
    assert!((total - 1000.0).abs() < 0.01);
}
