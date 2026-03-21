use super::*;
use wiremock::{Mock, MockServer, ResponseTemplate};
use wiremock::matchers::{method, path_regex};

#[tokio::test]
async fn test_get_markets_success() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!([
        {
            "address": "0xMarket1",
            "name": "PT-wstETH",
            "underlying_asset": "0xWSTETH",
            "pt_token": "0xPT1",
            "yt_token": "0xYT1",
            "expiry": 1735689600,
            "implied_apy": 8.5
        },
        {
            "address": "0xMarket2",
            "name": "PT-GLP",
            "underlying_asset": "0xGLP",
            "pt_token": "0xPT2",
            "yt_token": "0xYT2",
            "expiry": 1767225600,
            "implied_apy": 12.3
        }
    ]);

    Mock::given(method("GET"))
        .and(path_regex("/markets/.*"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    let result = service.get_markets(Chain::Ethereum).await;
    
    assert!(result.is_ok());
    let markets = result.unwrap();
    assert_eq!(markets.len(), 2);
    assert_eq!(markets[0].name, "PT-wstETH");
}

#[tokio::test]
async fn test_get_markets_empty() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!([]);

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    let result = service.get_markets(Chain::Ethereum).await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn test_get_markets_http_500() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    let result = service.get_markets(Chain::Ethereum).await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_markets_invalid_json() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_string("invalid json"))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    let result = service.get_markets(Chain::Ethereum).await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_user_positions_success() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!([
        {
            "market": "0xMarket1",
            "pt_balance": "1000000000000000000",
            "yt_balance": "500000000000000000",
            "value_usd": 3000.0
        }
    ]);

    Mock::given(method("GET"))
        .and(path_regex("/users/.*/positions.*"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    
    let result = service.get_user_positions(Chain::Ethereum, "0xUser").await;
    
    assert!(result.is_ok());
    let positions = result.unwrap();
    assert_eq!(positions.len(), 1);
}

#[tokio::test]
async fn test_get_user_positions_empty() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!([]);

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    
    let result = service.get_user_positions(Chain::Ethereum, "0xEmpty").await;
    
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn test_get_user_positions_not_found() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(404))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    
    let result = service.get_user_positions(Chain::Ethereum, "0xUser").await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_markets_multiple_chains() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!([
        {
            "address": "0xMarket",
            "name": "PT-wstETH",
            "underlying_asset": "0xWSTETH",
            "pt_token": "0xPT",
            "yt_token": "0xYT",
            "expiry": 1735689600,
            "implied_apy": 8.5
        }
    ]);

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    
    let eth_result = service.get_markets(Chain::Ethereum).await;
    assert!(eth_result.is_ok());
    
    let arb_result = service.get_markets(Chain::Arbitrum).await;
    assert!(arb_result.is_ok());
}

#[tokio::test]
async fn test_get_user_positions_multiple() {
    let mock_server = MockServer::start().await;
    
    let response_body = serde_json::json!([
        {
            "market": "0xMarket1",
            "pt_balance": "1000000000000000000",
            "yt_balance": "500000000000000000",
            "value_usd": 3000.0
        },
        {
            "market": "0xMarket2",
            "pt_balance": "2000000000000000000",
            "yt_balance": "1000000000000000000",
            "value_usd": 5000.0
        }
    ]);

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response_body))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    
    let result = service.get_user_positions(Chain::Ethereum, "0xUser").await;
    
    assert!(result.is_ok());
    let positions = result.unwrap();
    assert_eq!(positions.len(), 2);
}

#[tokio::test]
async fn test_get_markets_timeout() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(200).set_delay(std::time::Duration::from_secs(60)))
        .mount(&mock_server)
        .await;

    let service = PendleService::with_api_url(mock_server.uri());
    let result = tokio::time::timeout(
        std::time::Duration::from_millis(100),
        service.get_markets(Chain::Ethereum)
    ).await;

    assert!(result.is_err());
}
