use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoingeckoPriceResponse {
    #[serde(flatten)]
    pub prices: HashMap<String, CoinPrice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinPrice {
    pub usd: Option<f64>,
    pub usd_24h_change: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub id: String,
    pub symbol: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct PriceEntry {
    pub price_usd: f64,
    pub fetched_at: chrono::DateTime<chrono::Utc>,
}

impl PriceEntry {
    pub fn is_stale(&self, max_age_hours: i64) -> bool {
        let age = chrono::Utc::now() - self.fetched_at;
        age.num_hours() >= max_age_hours
    }
}

fn deserialize_price_points<'de, D>(deserializer: D) -> Result<Vec<(i64, f64)>, D::Error>
where
    D: Deserializer<'de>,
{
    let raw: Vec<[serde_json::Value; 2]> = Vec::deserialize(deserializer)?;
    let points = raw
        .into_iter()
        .filter_map(|pair| {
            let ts = pair[0].as_f64()? as i64;
            let price = pair[1].as_f64()?;
            Some((ts, price))
        })
        .collect();
    Ok(points)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketChartResponse {
    #[serde(deserialize_with = "deserialize_price_points")]
    pub prices: Vec<(i64, f64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinMarket {
    pub id: String,
    pub symbol: String,
    pub name: String,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub current_price: Option<f64>,
    #[serde(default)]
    pub market_cap: Option<f64>,
    #[serde(default)]
    pub market_cap_rank: Option<i64>,
    #[serde(default)]
    pub fully_diluted_valuation: Option<f64>,
    #[serde(default)]
    pub total_volume: Option<f64>,
    #[serde(default)]
    pub high_24h: Option<f64>,
    #[serde(default)]
    pub low_24h: Option<f64>,
    #[serde(default)]
    pub price_change_24h: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_24h: Option<f64>,
    #[serde(default)]
    pub market_cap_change_24h: Option<f64>,
    #[serde(default)]
    pub market_cap_change_percentage_24h: Option<f64>,
    #[serde(default)]
    pub circulating_supply: Option<f64>,
    #[serde(default)]
    pub total_supply: Option<f64>,
    #[serde(default)]
    pub max_supply: Option<f64>,
    #[serde(default)]
    pub ath: Option<f64>,
    #[serde(default)]
    pub ath_change_percentage: Option<f64>,
    #[serde(default)]
    pub ath_date: Option<String>,
    #[serde(default)]
    pub atl: Option<f64>,
    #[serde(default)]
    pub atl_change_percentage: Option<f64>,
    #[serde(default)]
    pub atl_date: Option<String>,
    #[serde(default)]
    pub last_updated: Option<String>,
    #[serde(default)]
    pub price_change_percentage_1h_in_currency: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_24h_in_currency: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_7d_in_currency: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_14d_in_currency: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_30d_in_currency: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_200d_in_currency: Option<f64>,
    #[serde(default)]
    pub price_change_percentage_1y_in_currency: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_real_coingecko_markets_response() {
        let raw = r#"[{"id":"bitcoin","symbol":"btc","name":"Bitcoin","image":"https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400","current_price":79092,"market_cap":1585131320240,"market_cap_rank":1,"fully_diluted_valuation":1585131320240,"total_volume":27034822093,"high_24h":79400,"low_24h":77352,"price_change_24h":1530.12,"price_change_percentage_24h":1.97277,"market_cap_change_24h":32136296496,"market_cap_change_percentage_24h":2.06931,"circulating_supply":20021265.0,"total_supply":20021265.0,"max_supply":21000000.0,"ath":126080,"ath_change_percentage":-37.26827,"ath_date":"2025-10-06T18:57:42.558Z","atl":67.81,"atl_change_percentage":116539.51421,"atl_date":"2013-07-06T00:00:00.000Z","roi":null,"last_updated":"2026-04-27T02:36:54.270Z","price_change_percentage_14d_in_currency":11.137918385483367,"price_change_percentage_1h_in_currency":0.130387979423434,"price_change_percentage_1y_in_currency":-16.671305413724706,"price_change_percentage_200d_in_currency":-35.69995010777702,"price_change_percentage_24h_in_currency":1.9727656606207207,"price_change_percentage_30d_in_currency":19.14539529465436,"price_change_percentage_7d_in_currency":6.383707259085194},{"id":"ethereum","symbol":"eth","name":"Ethereum","image":"https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628","current_price":2392.91,"market_cap":289029265308,"market_cap_rank":2,"fully_diluted_valuation":289029265308,"total_volume":11764548441,"high_24h":2398.19,"low_24h":2308.34,"price_change_24h":75.13,"price_change_percentage_24h":3.24146,"market_cap_change_24h":9307701935,"market_cap_change_percentage_24h":3.32749,"circulating_supply":120688626.1016112,"total_supply":120688626.1016112,"max_supply":null,"ath":4946.05,"ath_change_percentage":-51.61978,"ath_date":"2025-08-24T19:21:03.333Z","atl":0.432979,"atl_change_percentage":552561.88934,"atl_date":"2015-10-20T00:00:00.000Z","roi":{"times":39.44451140562025,"currency":"btc","percentage":3944.451140562025},"last_updated":"2026-04-27T02:36:54.582Z","price_change_percentage_14d_in_currency":8.50654829962968,"price_change_percentage_1h_in_currency":0.3262065765238428,"price_change_percentage_1y_in_currency":29.78984989093315,"price_change_percentage_200d_in_currency":-47.02318574507822,"price_change_percentage_24h_in_currency":3.2414638385765673,"price_change_percentage_30d_in_currency":20.179380769811374,"price_change_percentage_7d_in_currency":4.833179189483899},{"id":"solana","symbol":"sol","name":"Solana","image":"https://coin-images.coingecko.com/coins/images/4128/large/solana.png?1718769756","current_price":87.66,"market_cap":50517888701,"market_cap_rank":7,"fully_diluted_valuation":54845114309,"total_volume":2667102204,"high_24h":87.83,"low_24h":85.9,"price_change_24h":1.37,"price_change_percentage_24h":1.59065,"market_cap_change_24h":828188754,"market_cap_change_percentage_24h":1.66672,"circulating_supply":575850947.6692755,"total_supply":625176781.1705916,"max_supply":null,"ath":293.31,"ath_change_percentage":-70.11232,"ath_date":"2025-01-19T11:15:27.957Z","atl":0.500801,"atl_change_percentage":17404.77799,"atl_date":"2020-05-11T19:35:23.449Z","roi":null,"last_updated":"2026-04-27T02:36:54.364Z","price_change_percentage_14d_in_currency":6.751819211881975,"price_change_percentage_1h_in_currency":0.29907615195887405,"price_change_percentage_1y_in_currency":-41.51628093694689,"price_change_percentage_200d_in_currency":-61.65996312127948,"price_change_percentage_24h_in_currency":1.5906506768069817,"price_change_percentage_30d_in_currency":5.870108005695448,"price_change_percentage_7d_in_currency":4.305863289796387}]"#;

        let parsed: Vec<CoinMarket> = serde_json::from_str(raw).expect("parse markets");
        assert_eq!(parsed.len(), 3);

        let btc = &parsed[0];
        assert_eq!(btc.id, "bitcoin");
        assert_eq!(btc.symbol, "btc");
        assert_eq!(btc.current_price, Some(79092.0));
        assert_eq!(btc.market_cap_rank, Some(1));
        assert_eq!(btc.max_supply, Some(21_000_000.0));
        assert_eq!(btc.ath, Some(126080.0));
        assert_eq!(btc.ath_date.as_deref(), Some("2025-10-06T18:57:42.558Z"));
        assert_eq!(btc.last_updated.as_deref(), Some("2026-04-27T02:36:54.270Z"));
        assert!(btc.price_change_percentage_1h_in_currency.is_some());
        assert!(btc.price_change_percentage_24h_in_currency.is_some());
        assert!(btc.price_change_percentage_7d_in_currency.is_some());
        assert!(btc.price_change_percentage_14d_in_currency.is_some());
        assert!(btc.price_change_percentage_30d_in_currency.is_some());
        assert!(btc.price_change_percentage_200d_in_currency.is_some());
        assert!(btc.price_change_percentage_1y_in_currency.is_some());

        let eth = &parsed[1];
        assert!(eth.max_supply.is_none(), "ETH max_supply should be None");

        let sol = &parsed[2];
        assert_eq!(sol.market_cap_rank, Some(7));
        assert!(sol.fully_diluted_valuation.is_some());
    }
}
