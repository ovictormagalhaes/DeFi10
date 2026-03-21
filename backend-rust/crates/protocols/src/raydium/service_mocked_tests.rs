use super::*;
use wiremock::{Mock, MockServer, ResponseTemplate};
use wiremock::matchers::{method, path};

#[tokio::test]
async fn test_get_pools_success() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "data": [
            {
                "id": "Pool1",
                "name": "SOL-USDC",
                "lpMint": "LP1",
                "mintA": {
                    "address": "So11111111111111111111111111111111111111112",
                    "symbol": "SOL",
                    "decimals": 9
                },
                "mintB": {
                    "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    "symbol": "USDC",
                    "decimals": 6
                },
                "lpPrice": 10.0,
                "tvl": 1000000.0,
                "apr": 15.5
            }
        ]
    });

    Mock::given(method("GET"))
        .and(path("/pools"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let result = service.get_pools().await;
    
    assert!(result.is_ok());
    let pools = result.unwrap();
    assert_eq!(pools.len(), 1);
    assert_eq!(pools[0].name, "SOL-USDC");
}

#[tokio::test]
async fn test_get_pools_empty() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({ "data": [] });

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let result = service.get_pools().await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn test_get_pools_http_500() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let result = service.get_pools().await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_pools_invalid_json() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_string("invalid json"))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let result = service.get_pools().await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_user_position_success() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "poolId": "Pool123",
        "lpAmount": "1000000000",
        "lpValueUsd": 10000.0,
        "tokenAAmount": "5000000000",
        "tokenBAmount": "5000000"
    });

    Mock::given(method("GET"))
        .and(path("/users/Wallet123/positions/Pool123"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());
    
    let result = service.get_user_position("Wallet123", "Pool123", provider).await;
    
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_get_user_position_not_found() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());
    
    let result = service.get_user_position("Wallet123", "NonExistent", provider).await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_pools_multiple() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "data": [
            {
                "id": "Pool1",
                "name": "SOL-USDC",
                "lpMint": "LP1",
                "mintA": { "address": "SOL", "symbol": "SOL", "decimals": 9 },
                "mintB": { "address": "USDC", "symbol": "USDC", "decimals": 6 },
                "lpPrice": 10.0,
                "tvl": 1000000.0,
                "apr": 15.5
            },
            {
                "id": "Pool2",
                "name": "RAY-USDC",
                "lpMint": "LP2",
                "mintA": { "address": "RAY", "symbol": "RAY", "decimals": 6 },
                "mintB": { "address": "USDC", "symbol": "USDC", "decimals": 6 },
                "lpPrice": 5.0,
                "tvl": 500000.0,
                "apr": 20.0
            }
        ]
    });

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let result = service.get_pools().await;
    
    assert!(result.is_ok());
    let pools = result.unwrap();
    assert_eq!(pools.len(), 2);
    assert_eq!(pools[0].name, "SOL-USDC");
    assert_eq!(pools[1].apr, 20.0);
}

#[tokio::test]
async fn test_get_pools_timeout() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_delay(std::time::Duration::from_secs(60)))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let result = tokio::time::timeout(
        std::time::Duration::from_millis(100),
        service.get_pools()
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_user_position_zero_lp() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "poolId": "Pool1",
        "lpAmount": "0",
        "lpValueUsd": 0.0,
        "tokenAAmount": "0",
        "tokenBAmount": "0"
    });

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = RaydiumService::with_api_url(mock_server.uri());
    let provider = Arc::new(defi10_blockchain::MockProvider::new());
    
    let result = service.get_user_position("Wallet", "Pool1", provider).await;
    
    assert!(result.is_ok());
}
