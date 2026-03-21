use crate::Chain;

pub fn get_token_decimals(symbol: &str, chain: Chain, api_decimals: Option<u8>) -> u8 {
    if let Some(d) = api_decimals {
        return d;
    }

    match symbol.to_uppercase().as_str() {
        "USDC" | "USDT" | "USDBC" | "USDS" | "JLP" => 6,
        "WBTC" | "CBBTC" | "TBTC" => 8,
        _ => default_decimals_for_chain(chain),
    }
}

pub fn default_decimals_for_chain(chain: Chain) -> u8 {
    match chain {
        Chain::Solana => 9,
        _ => 18,
    }
}

pub fn convert_raw_to_human(raw_str: &str, decimals: u8) -> f64 {
    let raw = raw_str.parse::<f64>().unwrap_or(0.0);
    if decimals == 0 {
        return raw;
    }
    raw / 10f64.powi(decimals as i32)
}
