pub mod adapter;
pub mod models;
pub mod service;

pub use adapter::KaminoAdapter;
pub use models::KaminoTransactionEvent;
pub use service::KaminoService;

pub fn get_decimals_for_symbol_pub(symbol: &str) -> u8 {
    service::get_decimals_for_symbol_pub(symbol)
}

pub fn attach_transaction_history(
    results: &mut [defi10_core::aggregation::AggregationResult],
    events: &[KaminoTransactionEvent],
) {
    if events.is_empty() {
        return;
    }

    let mut by_mint: std::collections::HashMap<String, Vec<&KaminoTransactionEvent>> =
        std::collections::HashMap::new();
    for event in events {
        by_mint
            .entry(event.mint_address.clone())
            .or_default()
            .push(event);
    }

    for (mint_addr, mint_events) in by_mint {
        let symbol = mint_events
            .first()
            .map(|e| e.token_symbol.clone())
            .unwrap_or_default();
        let decimals = get_decimals_for_symbol_pub(&symbol);

        let deposits: Vec<_> = mint_events
            .iter()
            .filter(|e| e.event_type == "deposit")
            .collect();
        let borrows: Vec<_> = mint_events
            .iter()
            .filter(|e| e.event_type == "borrow")
            .collect();

        if !deposits.is_empty() {
            if let Some(result) = results
                .iter_mut()
                .find(|r| r.token_address == mint_addr && r.position_type == "lending")
            {
                let supplies: Vec<serde_json::Value> = deposits
                    .iter()
                    .map(|e| {
                        let raw = (e.amount_change * 10f64.powi(decimals as i32)) as u128;
                        serde_json::json!({
                            "mintAddress": e.mint_address,
                            "symbol": e.token_symbol,
                            "balance": raw.to_string(),
                            "timestamp": e.timestamp
                        })
                    })
                    .collect();

                let metadata = result.metadata.get_or_insert_with(|| serde_json::json!({}));
                metadata["supplies"] = serde_json::Value::Array(supplies);
                metadata["suppliesTokens"] = serde_json::json!([{
                    "mintAddress": mint_addr,
                    "symbol": symbol,
                    "name": symbol,
                    "decimals": decimals
                }]);
            }
        }

        if !borrows.is_empty() {
            if let Some(result) = results
                .iter_mut()
                .find(|r| r.token_address == mint_addr && r.position_type == "borrowing")
            {
                let borrow_items: Vec<serde_json::Value> = borrows
                    .iter()
                    .map(|e| {
                        let raw = (e.amount_change * 10f64.powi(decimals as i32)) as u128;
                        serde_json::json!({
                            "mintAddress": e.mint_address,
                            "symbol": e.token_symbol,
                            "balance": raw.to_string(),
                            "timestamp": e.timestamp
                        })
                    })
                    .collect();

                let metadata = result.metadata.get_or_insert_with(|| serde_json::json!({}));
                metadata["borrows"] = serde_json::Value::Array(borrow_items);
                metadata["borrowsTokens"] = serde_json::json!([{
                    "mintAddress": mint_addr,
                    "symbol": symbol,
                    "name": symbol,
                    "decimals": decimals
                }]);
            }
        }
    }
}
