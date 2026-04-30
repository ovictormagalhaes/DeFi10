use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Datelike, TimeZone, Utc};
use futures_util::future::join_all;
use tokio::sync::Semaphore;

use defi10_core::strategy::{
    BestPurchaseWindowEntry, PriceDirection, PurchaseTrigger, PurchaseWindowEvalResult,
    TokenMarketData, TriggerEvaluation, WindowDirection,
};

use crate::cache::{CacheService, RedisCache};
use crate::external::coingecko::client::CoingeckoClient;
use crate::external::coingecko::CoinMarket;

const CACHE_PREFIX: &str = "defi10:chart";
const MARKETS_CACHE_PREFIX: &str = "defi10:markets";
const CHART_CACHE_TTL: Duration = Duration::from_secs(3600);
const MARKETS_CACHE_TTL: Duration = Duration::from_secs(300);
const MAX_CONCURRENT: usize = 10;

pub struct PurchaseWindowService {
    cache: Arc<RedisCache>,
    coingecko: Arc<CoingeckoClient>,
    semaphore: Arc<Semaphore>,
}

impl PurchaseWindowService {
    pub fn new(cache: Arc<RedisCache>, coingecko: Arc<CoingeckoClient>) -> Self {
        Self {
            cache,
            coingecko,
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT)),
        }
    }

    pub async fn evaluate_entries(
        &self,
        entries: &[BestPurchaseWindowEntry],
    ) -> Vec<PurchaseWindowEvalResult> {
        let unique_ids: Vec<String> = entries
            .iter()
            .map(|e| e.coingecko_id.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let markets_by_id = self.get_markets_cached(&unique_ids).await;

        let futures: Vec<_> = entries
            .iter()
            .map(|e| async move {
                let outcome = self.evaluate_entry(e).await;
                let ytd_pct = self.compute_ytd_pct(&e.coingecko_id).await;
                (e, outcome, ytd_pct)
            })
            .collect();

        join_all(futures)
            .await
            .into_iter()
            .map(|(entry, outcome, ytd_pct)| {
                let mut market_data = markets_by_id.get(entry.coingecko_id.as_str()).cloned();
                if let (Some(md), Some(pct)) = (market_data.as_mut(), ytd_pct) {
                    md.price_change_percentage_ytd = Some(pct);
                }
                match outcome {
                    Ok(mut result) => {
                        result.market_data = market_data;
                        result
                    }
                    Err(e) => {
                        let err_str = e.to_string();
                        tracing::warn!(
                            "[PurchaseWindow] Entry evaluation failed for {} ({}): {}",
                            entry.asset_key,
                            entry.coingecko_id,
                            err_str
                        );
                        let fallback_price = market_data
                            .as_ref()
                            .and_then(|m| m.current_price)
                            .unwrap_or(0.0);
                        PurchaseWindowEvalResult {
                            asset_key: entry.asset_key.clone(),
                            symbol: entry.symbol.clone(),
                            current_price_usd: fallback_price,
                            trigger: entry.effective_triggers().into_iter().next(),
                            signal: false,
                            reference_price: 0.0,
                            reference_label: "dados indisponíveis".to_string(),
                            evaluations: Vec::new(),
                            fetched_at: Utc::now(),
                            market_data,
                            data_unavailable: true,
                            error_message: Some(err_str),
                        }
                    }
                }
            })
            .collect()
    }

    async fn get_markets_cached(
        &self,
        coingecko_ids: &[String],
    ) -> HashMap<String, TokenMarketData> {
        if coingecko_ids.is_empty() {
            return HashMap::new();
        }

        let mut result: HashMap<String, TokenMarketData> = HashMap::new();
        let mut missing: Vec<String> = Vec::new();

        for id in coingecko_ids {
            match self
                .cache
                .get::<TokenMarketData>(MARKETS_CACHE_PREFIX, id)
                .await
            {
                Ok(Some(data)) => {
                    result.insert(id.clone(), data);
                }
                _ => missing.push(id.clone()),
            }
        }

        if missing.is_empty() {
            return result;
        }

        let refs: Vec<&str> = missing.iter().map(|s| s.as_str()).collect();
        match self.coingecko.get_markets(&refs).await {
            Ok(markets) => {
                for m in markets {
                    let id = m.id.clone();
                    let data = coin_market_to_token_market_data(m);
                    let _ = self
                        .cache
                        .set(MARKETS_CACHE_PREFIX, &id, &data, Some(MARKETS_CACHE_TTL))
                        .await;
                    result.insert(id, data);
                }
            }
            Err(e) => {
                tracing::warn!("[PurchaseWindow] Failed to fetch markets: {}", e);
            }
        }

        result
    }

    async fn evaluate_entry(
        &self,
        entry: &BestPurchaseWindowEntry,
    ) -> anyhow::Result<PurchaseWindowEvalResult> {
        let _permit = self.semaphore.acquire().await?;
        let now = Utc::now();
        let now_ts = now.timestamp();

        let prices = self.get_chart_cached(&entry.coingecko_id, now_ts).await?;

        if prices.is_empty() {
            return Err(anyhow::anyhow!(
                "No price data returned for {}",
                entry.coingecko_id
            ));
        }

        let current_price = prices.last().map(|(_, p)| *p).unwrap_or(0.0);

        let triggers = entry.effective_triggers();
        if triggers.is_empty() {
            return Err(anyhow::anyhow!("Entry {} has no triggers", entry.asset_key));
        }

        let mut evaluations: Vec<TriggerEvaluation> = Vec::with_capacity(triggers.len());

        for trigger in &triggers {
            let eval = evaluate_single_trigger(trigger, &prices, now_ts, current_price)?;
            evaluations.push(eval);
        }

        let signal = evaluations.iter().all(|e| e.signal);

        let primary = pick_primary_evaluation(&evaluations);
        let reference_price = primary.reference_price;
        let reference_label = primary.reference_label.clone();

        Ok(PurchaseWindowEvalResult {
            asset_key: entry.asset_key.clone(),
            symbol: entry.symbol.clone(),
            current_price_usd: current_price,
            trigger: triggers.first().cloned(),
            signal,
            reference_price,
            reference_label,
            evaluations,
            fetched_at: now,
            market_data: None,
            data_unavailable: false,
            error_message: None,
        })
    }

    async fn compute_ytd_pct(&self, coingecko_id: &str) -> Option<f64> {
        let now_ts = Utc::now().timestamp();
        let prices = self.get_chart_cached(coingecko_id, now_ts).await.ok()?;
        if prices.len() < 2 {
            return None;
        }
        let first = prices.first()?.1;
        let last = prices.last()?.1;
        if first == 0.0 {
            return None;
        }
        Some(((last - first) / first) * 100.0)
    }

    async fn get_chart_cached(
        &self,
        coingecko_id: &str,
        now_ts: i64,
    ) -> anyhow::Result<Vec<(i64, f64)>> {
        if let Ok(Some(cached)) = self
            .cache
            .get::<Vec<(i64, f64)>>(CACHE_PREFIX, coingecko_id)
            .await
        {
            tracing::debug!("[PurchaseWindow] Cache hit for {}", coingecko_id);
            return Ok(cached);
        }

        let ytd = ytd_start(now_ts);
        let one_year_ago = now_ts - 365 * 86_400;
        let from = ytd.min(one_year_ago);
        let data = self
            .coingecko
            .get_market_chart_range(coingecko_id, from, now_ts)
            .await?;

        let _ = self
            .cache
            .set(CACHE_PREFIX, coingecko_id, &data, Some(CHART_CACHE_TTL))
            .await;

        Ok(data)
    }
}

fn evaluate_single_trigger(
    trigger: &PurchaseTrigger,
    prices: &[(i64, f64)],
    now_ts: i64,
    current_price: f64,
) -> anyhow::Result<TriggerEvaluation> {
    match trigger {
        PurchaseTrigger::Price { target, direction } => {
            let signal = match direction {
                PriceDirection::Below => current_price < *target,
                PriceDirection::Above => current_price > *target,
            };
            let dir_label = match direction {
                PriceDirection::Below => "abaixo de",
                PriceDirection::Above => "acima de",
            };
            Ok(TriggerEvaluation {
                trigger: trigger.clone(),
                reference_price: *target,
                reference_label: format!("preço {} ${:.2}", dir_label, target),
                signal,
            })
        }
        PurchaseTrigger::Window { window, direction } => {
            let window_start_ts_ms = window.start_unix(now_ts) * 1000;
            let window_prices: Vec<(i64, f64)> = prices
                .iter()
                .filter(|(ts_ms, _)| *ts_ms >= window_start_ts_ms)
                .copied()
                .collect();

            if window_prices.is_empty() {
                return Err(anyhow::anyhow!("No data in window {:?}", window));
            }

            let (ref_ts_ms, ref_price) = window_prices.first().copied().unwrap();

            let signal = match direction {
                WindowDirection::Min => current_price < ref_price,
                WindowDirection::Max => current_price > ref_price,
            };

            let ref_date = chrono::DateTime::from_timestamp_millis(ref_ts_ms)
                .map(|dt| dt.format("%d %b").to_string())
                .unwrap_or_default();

            let dir_label = match direction {
                WindowDirection::Min => "negativo",
                WindowDirection::Max => "positivo",
            };

            Ok(TriggerEvaluation {
                trigger: trigger.clone(),
                reference_price: ref_price,
                reference_label: format!(
                    "% {} em {} (início ${:.2} em {})",
                    dir_label,
                    window.label(),
                    ref_price,
                    ref_date
                ),
                signal,
            })
        }
    }
}

fn pick_primary_evaluation(evaluations: &[TriggerEvaluation]) -> &TriggerEvaluation {
    evaluations
        .iter()
        .find(|e| !e.signal)
        .unwrap_or(&evaluations[0])
}

fn coin_market_to_token_market_data(m: CoinMarket) -> TokenMarketData {
    TokenMarketData {
        image: m.image,
        current_price: m.current_price,
        last_updated: m.last_updated.as_deref().and_then(parse_iso_datetime),
        market_cap: m.market_cap,
        market_cap_rank: m.market_cap_rank,
        fully_diluted_valuation: m.fully_diluted_valuation,
        total_volume: m.total_volume,
        high_24h: m.high_24h,
        low_24h: m.low_24h,
        price_change_24h: m.price_change_24h,
        price_change_percentage_1h: m.price_change_percentage_1h_in_currency,
        price_change_percentage_24h: m
            .price_change_percentage_24h_in_currency
            .or(m.price_change_percentage_24h),
        price_change_percentage_7d: m.price_change_percentage_7d_in_currency,
        price_change_percentage_14d: m.price_change_percentage_14d_in_currency,
        price_change_percentage_30d: m.price_change_percentage_30d_in_currency,
        price_change_percentage_200d: m.price_change_percentage_200d_in_currency,
        price_change_percentage_1y: m.price_change_percentage_1y_in_currency,
        price_change_percentage_ytd: None,
        market_cap_change_24h: m.market_cap_change_24h,
        market_cap_change_percentage_24h: m.market_cap_change_percentage_24h,
        circulating_supply: m.circulating_supply,
        total_supply: m.total_supply,
        max_supply: m.max_supply,
        ath: m.ath,
        ath_change_percentage: m.ath_change_percentage,
        ath_date: m.ath_date.as_deref().and_then(parse_iso_datetime),
        atl: m.atl,
        atl_change_percentage: m.atl_change_percentage,
        atl_date: m.atl_date.as_deref().and_then(parse_iso_datetime),
    }
}

fn parse_iso_datetime(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn ytd_start(now_ts: i64) -> i64 {
    let dt = Utc
        .timestamp_opt(now_ts, 0)
        .single()
        .unwrap_or_else(Utc::now);
    Utc.with_ymd_and_hms(dt.year(), 1, 1, 0, 0, 0)
        .single()
        .map(|d| d.timestamp())
        .unwrap_or(now_ts - 365 * 86_400)
}
