use super::*;
use wiremock::{Mock, MockServer, ResponseTemplate};
use wiremock::matchers::{method, path_regex};

#[tokio::test]
async fn test_fetch_user_positions_success() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "data": {
            "positions": [
                {
                    "id": "1",
                    "owner": "0xOwner",
                    "liquidity": "1000000",
                    "depositedToken0": "100",
                    "depositedToken1": "200",
                    "withdrawnToken0": "0",
                    "withdrawnToken1": "0",
                    "collectedFeesToken0": "10",
                    "collectedFeesToken1": "20",
                    "pool": {
                        "id": "0xPool",
                        "feeTier": "3000",
                        "token0": { "id": "0xUSDC", "symbol": "USDC", "decimals": "6" },
                        "token1": { "id": "0xWETH", "symbol": "WETH", "decimals": "18" },
                        "tick": "100",
                        "sqrtPrice": "1000000000000000000",
                        "liquidity": "500000000"
                    },
                    "tickLower": { "tickIdx": "-100" },
                    "tickUpper": { "tickIdx": "100" }
                }
            ]
        }
    });

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let mut service = UniswapV3Service::new();
    service.subgraph_urls.insert(Chain::Ethereum, mock_server.uri());
    
    let result = service.fetch_user_positions(&mock_server.uri(), "0xOwner").await;
    
    assert!(result.is_ok());
    let positions = result.unwrap();
    assert_eq!(positions.len(), 1);
    assert_eq!(positions[0].id, "1");
}

#[tokio::test]
async fn test_fetch_user_positions_empty() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "data": {
            "positions": []
        }
    });

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = service.fetch_user_positions(&mock_server.uri(), "0xEmpty").await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn test_fetch_user_positions_null_data() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({ "data": null });

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = service.fetch_user_positions(&mock_server.uri(), "0xUser").await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn test_fetch_user_positions_http_500() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = service.fetch_user_positions(&mock_server.uri(), "0xUser").await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_fetch_user_positions_invalid_json() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_string("invalid json"))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = service.fetch_user_positions(&mock_server.uri(), "0xUser").await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_fetch_user_positions_multiple() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "data": {
            "positions": [
                {
                    "id": "1",
                    "owner": "0xOwner",
                    "liquidity": "1000000",
                    "depositedToken0": "100",
                    "depositedToken1": "200",
                    "withdrawnToken0": "0",
                    "withdrawnToken1": "0",
                    "collectedFeesToken0": "10",
                    "collectedFeesToken1": "20",
                    "pool": {
                        "id": "0xPool1",
                        "feeTier": "3000",
                        "token0": { "id": "0xUSDC", "symbol": "USDC", "decimals": "6" },
                        "token1": { "id": "0xWETH", "symbol": "WETH", "decimals": "18" },
                        "tick": "100",
                        "sqrtPrice": "1000000000000000000",
                        "liquidity": "500000000"
                    },
                    "tickLower": { "tickIdx": "-100" },
                    "tickUpper": { "tickIdx": "100" }
                },
                {
                    "id": "2",
                    "owner": "0xOwner",
                    "liquidity": "2000000",
                    "depositedToken0": "200",
                    "depositedToken1": "400",
                    "withdrawnToken0": "0",
                    "withdrawnToken1": "0",
                    "collectedFeesToken0": "20",
                    "collectedFeesToken1": "40",
                    "pool": {
                        "id": "0xPool2",
                        "feeTier": "500",
                        "token0": { "id": "0xUSDT", "symbol": "USDT", "decimals": "6" },
                        "token1": { "id": "0xDAI", "symbol": "DAI", "decimals": "18" },
                        "tick": "50",
                        "sqrtPrice": "2000000000000000000",
                        "liquidity": "600000000"
                    },
                    "tickLower": { "tickIdx": "-200" },
                    "tickUpper": { "tickIdx": "200" }
                }
            ]
        }
    });

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = service.fetch_user_positions(&mock_server.uri(), "0xOwner").await;
    
    assert!(result.is_ok());
    let positions = result.unwrap();
    assert_eq!(positions.len(), 2);
    assert_eq!(positions[0].pool.token0.symbol, "USDC");
    assert_eq!(positions[1].pool.token0.symbol, "USDT");
}

#[tokio::test]
async fn test_fetch_user_positions_timeout() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_delay(std::time::Duration::from_secs(60)))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = tokio::time::timeout(
        std::time::Duration::from_millis(100),
        service.fetch_user_positions(&mock_server.uri(), "0xUser")
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_fetch_positions_with_fees() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!({
        "data": {
            "positions": [{
                "id": "99",
                "owner": "0xOwner",
                "liquidity": "5000000",
                "depositedToken0": "500",
                "depositedToken1": "1000",
                "withdrawnToken0": "100",
                "withdrawnToken1": "200",
                "collectedFeesToken0": "50",
                "collectedFeesToken1": "100",
                "pool": {
                    "id": "0xPool",
                    "feeTier": "10000",
                    "token0": { "id": "0xUSDC", "symbol": "USDC", "decimals": "6" },
                    "token1": { "id": "0xWETH", "symbol": "WETH", "decimals": "18" },
                    "tick": "100",
                    "sqrtPrice": "1000000000000000000",
                    "liquidity": "500000000"
                },
                "tickLower": { "tickIdx": "-100" },
                "tickUpper": { "tickIdx": "100" }
            }]
        }
    });

    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = UniswapV3Service::new();
    let result = service.fetch_user_positions(&mock_server.uri(), "0xOwner").await;
    
    assert!(result.is_ok());
    let positions = result.unwrap();
    assert_eq!(positions[0].collected_fees_token0, "50");
    assert_eq!(positions[0].collected_fees_token1, "100");
}
