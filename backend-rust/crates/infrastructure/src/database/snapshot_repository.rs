use async_trait::async_trait;
use defi10_core::{
    DailySnapshot, DeFi10Error, HistoryPoint, PortfolioAnalytics, PositionHistoryPoint, Result,
    SnapshotSummary, SyncSnapshot, SyncSnapshotSummary,
};
use mongodb::{
    bson::{doc, to_document, Document},
    options::{FindOneOptions, FindOptions, UpdateOptions},
    Collection, Database,
};
use uuid::Uuid;

#[async_trait]
pub trait SnapshotRepositoryTrait: Send + Sync {
    async fn upsert_snapshot(&self, snapshot: &DailySnapshot) -> Result<()>;
    async fn upsert_analytics(&self, analytics: &PortfolioAnalytics) -> Result<()>;
    async fn get_history(
        &self,
        wallet_group_id: &Uuid,
        from: &str,
        to: &str,
    ) -> Result<Vec<HistoryPoint>>;
    async fn get_snapshot(
        &self,
        wallet_group_id: &Uuid,
        date: &str,
    ) -> Result<Option<DailySnapshot>>;
    async fn get_analytics(
        &self,
        wallet_group_id: &Uuid,
        date: &str,
    ) -> Result<Option<PortfolioAnalytics>>;
    async fn get_analytics_range(
        &self,
        wallet_group_id: &Uuid,
        from: &str,
        to: &str,
    ) -> Result<Vec<PortfolioAnalytics>>;
    async fn get_position_history(
        &self,
        wallet_group_id: &Uuid,
        token: &str,
        from: &str,
        to: &str,
    ) -> Result<Vec<PositionHistoryPoint>>;
    async fn get_recent_totals(&self, wallet_group_id: &Uuid, days: u32) -> Result<Vec<f64>>;
    async fn get_first_snapshot(&self, wallet_group_id: &Uuid) -> Result<Option<DailySnapshot>>;
    async fn get_wallet_group_ids_with_snapshot(&self, date: &str) -> Result<Vec<String>>;
    async fn get_wallet_group_ids_with_recent_snapshot(
        &self,
        since: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<String>>;
    async fn insert_sync_snapshot(&self, snapshot: &SyncSnapshot) -> Result<()>;
    async fn get_sync_snapshots(
        &self,
        wallet_group_id: &Uuid,
        from: &str,
        to: &str,
    ) -> Result<Vec<SyncSnapshotSummary>>;
    async fn get_sync_snapshot_detail(
        &self,
        wallet_group_id: &Uuid,
        id: &str,
    ) -> Result<Option<SyncSnapshot>>;
    async fn delete_old_snapshots(&self, before_date: &str) -> Result<u32>;
    async fn delete_old_analytics(&self, before_date: &str) -> Result<u32>;
    async fn delete_old_sync_snapshots(&self, before_date: &str) -> Result<u32>;
}

pub struct SnapshotRepository {
    snapshots: Collection<Document>,
    analytics: Collection<Document>,
    sync_snapshots: Collection<Document>,
}

impl SnapshotRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            snapshots: db.collection("daily_snapshots"),
            analytics: db.collection("portfolio_analytics"),
            sync_snapshots: db.collection("sync_snapshots"),
        }
    }
}

#[async_trait]
impl SnapshotRepositoryTrait for SnapshotRepository {
    async fn upsert_snapshot(&self, snapshot: &DailySnapshot) -> Result<()> {
        let filter = doc! {
            "walletGroupId": snapshot.wallet_group_id.to_string(),
            "date": &snapshot.date,
        };

        let doc = to_document(snapshot)
            .map_err(|e| DeFi10Error::Database(format!("Failed to serialize snapshot: {}", e)))?;

        let update = doc! { "$set": doc };
        let options = UpdateOptions::builder().upsert(true).build();

        self.snapshots
            .update_one(filter, update)
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to upsert snapshot: {}", e)))?;

        Ok(())
    }

    async fn upsert_analytics(&self, analytics: &PortfolioAnalytics) -> Result<()> {
        let filter = doc! {
            "walletGroupId": analytics.wallet_group_id.to_string(),
            "date": &analytics.date,
        };

        let doc = to_document(analytics)
            .map_err(|e| DeFi10Error::Database(format!("Failed to serialize analytics: {}", e)))?;

        let update = doc! { "$set": doc };
        let options = UpdateOptions::builder().upsert(true).build();

        self.analytics
            .update_one(filter, update)
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to upsert analytics: {}", e)))?;

        Ok(())
    }

    async fn get_history(
        &self,
        wallet_group_id: &Uuid,
        from: &str,
        to: &str,
    ) -> Result<Vec<HistoryPoint>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": { "$gte": from, "$lte": to },
        };

        let options = FindOptions::builder()
            .sort(doc! { "date": 1 })
            .projection(doc! {
                "date": 1,
                "totalValueUsd": 1,
                "summary": 1,
            })
            .build();

        let mut cursor = self
            .snapshots
            .find(filter.clone())
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to query history: {}", e)))?;

        let analytics_filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": { "$gte": from, "$lte": to },
        };
        let analytics_options = FindOptions::builder()
            .sort(doc! { "date": 1 })
            .projection(doc! { "date": 1, "dailyPnl": 1, "dailyPnlPercent": 1 })
            .build();

        let mut analytics_cursor = self
            .analytics
            .find(analytics_filter)
            .with_options(analytics_options)
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to query analytics for history: {}", e))
            })?;

        let mut analytics_map: std::collections::HashMap<String, (f64, f64)> =
            std::collections::HashMap::new();

        while analytics_cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate analytics: {}", e)))?
        {
            let doc = analytics_cursor.current();
            if let Ok(a) = mongodb::bson::from_slice::<AnalyticsPartial>(doc.as_bytes()) {
                analytics_map.insert(a.date, (a.daily_pnl, a.daily_pnl_percent));
            }
        }

        let mut points = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate history: {}", e)))?
        {
            let doc = cursor.current();
            if let Ok(snap) = mongodb::bson::from_slice::<SnapshotPartial>(doc.as_bytes()) {
                let (daily_pnl, daily_pnl_percent) =
                    analytics_map.get(&snap.date).copied().unwrap_or((0.0, 0.0));

                points.push(HistoryPoint {
                    date: snap.date,
                    total_value_usd: snap.total_value_usd,
                    daily_pnl,
                    daily_pnl_percent,
                    summary: snap.summary,
                });
            }
        }

        Ok(points)
    }

    async fn get_snapshot(
        &self,
        wallet_group_id: &Uuid,
        date: &str,
    ) -> Result<Option<DailySnapshot>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": date,
        };

        let doc = self
            .snapshots
            .find_one(filter)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to find snapshot: {}", e)))?;

        match doc {
            Some(d) => {
                let snapshot: DailySnapshot = mongodb::bson::from_document(d).map_err(|e| {
                    DeFi10Error::Database(format!("Failed to deserialize snapshot: {}", e))
                })?;
                Ok(Some(snapshot))
            }
            None => Ok(None),
        }
    }

    async fn get_analytics(
        &self,
        wallet_group_id: &Uuid,
        date: &str,
    ) -> Result<Option<PortfolioAnalytics>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": date,
        };

        let doc = self
            .analytics
            .find_one(filter)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to find analytics: {}", e)))?;

        match doc {
            Some(d) => {
                let analytics: PortfolioAnalytics =
                    mongodb::bson::from_document(d).map_err(|e| {
                        DeFi10Error::Database(format!("Failed to deserialize analytics: {}", e))
                    })?;
                Ok(Some(analytics))
            }
            None => Ok(None),
        }
    }

    async fn get_analytics_range(
        &self,
        wallet_group_id: &Uuid,
        from: &str,
        to: &str,
    ) -> Result<Vec<PortfolioAnalytics>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": { "$gte": from, "$lte": to },
        };

        let options = FindOptions::builder().sort(doc! { "date": 1 }).build();

        let mut cursor = self
            .analytics
            .find(filter)
            .with_options(options)
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to query analytics range: {}", e))
            })?;

        let mut results = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate analytics: {}", e)))?
        {
            let doc = cursor.current();
            let analytics: PortfolioAnalytics =
                mongodb::bson::from_slice(doc.as_bytes()).map_err(|e| {
                    DeFi10Error::Database(format!("Failed to deserialize analytics: {}", e))
                })?;
            results.push(analytics);
        }

        Ok(results)
    }

    async fn get_position_history(
        &self,
        wallet_group_id: &Uuid,
        token: &str,
        from: &str,
        to: &str,
    ) -> Result<Vec<PositionHistoryPoint>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": { "$gte": from, "$lte": to },
        };

        let options = FindOptions::builder()
            .sort(doc! { "date": 1 })
            .projection(doc! { "date": 1, "positions": 1 })
            .build();

        let mut cursor = self
            .snapshots
            .find(filter)
            .with_options(options)
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to query position history: {}", e))
            })?;

        let token_lower = token.to_lowercase();
        let mut points = Vec::new();

        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate snapshots: {}", e)))?
        {
            let doc = cursor.current();
            if let Ok(snap) = mongodb::bson::from_slice::<SnapshotWithPositions>(doc.as_bytes()) {
                let mut total_balance = 0.0;
                let mut total_value = 0.0;
                let mut last_price = 0.0;

                for pos in &snap.positions {
                    if pos.token_symbol.to_lowercase() == token_lower {
                        total_balance += pos.balance;
                        total_value += pos.value_usd;
                        last_price = pos.price_usd;
                    }
                }

                if total_value > 0.0 {
                    points.push(PositionHistoryPoint {
                        date: snap.date,
                        balance: total_balance,
                        value_usd: total_value,
                        price_usd: last_price,
                    });
                }
            }
        }

        Ok(points)
    }

    async fn get_recent_totals(&self, wallet_group_id: &Uuid, days: u32) -> Result<Vec<f64>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
        };

        let options = FindOptions::builder()
            .sort(doc! { "date": -1 })
            .limit(days as i64)
            .projection(doc! { "totalValueUsd": 1 })
            .build();

        let mut cursor = self
            .snapshots
            .find(filter)
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to query recent totals: {}", e)))?;

        let mut totals = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate totals: {}", e)))?
        {
            let doc = cursor.current();
            if let Ok(val) = mongodb::bson::from_slice::<TotalOnly>(doc.as_bytes()) {
                totals.push(val.total_value_usd);
            }
        }

        totals.reverse();
        Ok(totals)
    }

    async fn get_first_snapshot(&self, wallet_group_id: &Uuid) -> Result<Option<DailySnapshot>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
        };

        let options = FindOneOptions::builder().sort(doc! { "date": 1 }).build();

        let doc = self
            .snapshots
            .find_one(filter)
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to find first snapshot: {}", e)))?;

        match doc {
            Some(d) => {
                let snapshot: DailySnapshot = mongodb::bson::from_document(d).map_err(|e| {
                    DeFi10Error::Database(format!("Failed to deserialize snapshot: {}", e))
                })?;
                Ok(Some(snapshot))
            }
            None => Ok(None),
        }
    }

    async fn get_wallet_group_ids_with_snapshot(&self, date: &str) -> Result<Vec<String>> {
        let filter = doc! { "date": date };
        let options = FindOptions::builder()
            .projection(doc! { "walletGroupId": 1 })
            .build();

        let mut cursor = self
            .snapshots
            .find(filter)
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to query snapshot ids: {}", e)))?;

        let mut ids = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate ids: {}", e)))?
        {
            let doc = cursor.current();
            if let Ok(entry) = mongodb::bson::from_slice::<WalletGroupIdOnly>(doc.as_bytes()) {
                ids.push(entry.wallet_group_id);
            }
        }

        Ok(ids)
    }

    async fn get_wallet_group_ids_with_recent_snapshot(
        &self,
        since: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<String>> {
        let filter = doc! {
            "createdAt": { "$gte": since.to_rfc3339() },
        };

        let options = FindOptions::builder()
            .projection(doc! { "walletGroupId": 1 })
            .build();

        let mut cursor = self
            .snapshots
            .find(filter)
            .with_options(options)
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to query recent snapshot ids: {}", e))
            })?;

        let mut ids = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate recent ids: {}", e)))?
        {
            let doc = cursor.current();
            if let Ok(entry) = mongodb::bson::from_slice::<WalletGroupIdOnly>(doc.as_bytes()) {
                ids.push(entry.wallet_group_id);
            }
        }

        Ok(ids)
    }

    async fn insert_sync_snapshot(&self, snapshot: &SyncSnapshot) -> Result<()> {
        let doc = mongodb::bson::to_document(snapshot).map_err(|e| {
            DeFi10Error::Database(format!("Failed to serialize sync snapshot: {}", e))
        })?;

        self.sync_snapshots
            .insert_one(doc)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to insert sync snapshot: {}", e)))?;

        Ok(())
    }

    async fn get_sync_snapshots(
        &self,
        wallet_group_id: &Uuid,
        from: &str,
        to: &str,
    ) -> Result<Vec<SyncSnapshotSummary>> {
        let filter = doc! {
            "walletGroupId": wallet_group_id.to_string(),
            "date": { "$gte": from, "$lte": to },
        };

        let options = FindOptions::builder()
            .sort(doc! { "syncedAt": -1 })
            .projection(doc! {
                "_id": 1,
                "walletGroupId": 1,
                "date": 1,
                "syncedAt": 1,
                "totalValueUsd": 1,
                "summary": 1,
            })
            .build();

        let mut cursor = self
            .sync_snapshots
            .find(filter)
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to query sync snapshots: {}", e)))?;

        let mut results = Vec::new();
        while cursor.advance().await.map_err(|e| {
            DeFi10Error::Database(format!("Failed to iterate sync snapshots: {}", e))
        })? {
            let doc = cursor.current();
            if let Ok(p) = mongodb::bson::from_slice::<SyncSummaryPartial>(doc.as_bytes()) {
                if let (Ok(id), Ok(wg_id)) =
                    (Uuid::parse_str(&p.id), Uuid::parse_str(&p.wallet_group_id))
                {
                    results.push(SyncSnapshotSummary {
                        id,
                        wallet_group_id: wg_id,
                        date: p.date,
                        synced_at: p.synced_at,
                        total_value_usd: p.total_value_usd,
                        summary: p.summary,
                    });
                }
            }
        }

        Ok(results)
    }

    async fn get_sync_snapshot_detail(
        &self,
        wallet_group_id: &Uuid,
        id: &str,
    ) -> Result<Option<SyncSnapshot>> {
        let filter = doc! {
            "_id": id,
            "walletGroupId": wallet_group_id.to_string(),
        };

        let doc =
            self.sync_snapshots.find_one(filter).await.map_err(|e| {
                DeFi10Error::Database(format!("Failed to find sync snapshot: {}", e))
            })?;

        match doc {
            Some(d) => {
                let snapshot: SyncSnapshot = mongodb::bson::from_document(d).map_err(|e| {
                    DeFi10Error::Database(format!("Failed to deserialize sync snapshot: {}", e))
                })?;
                Ok(Some(snapshot))
            }
            None => Ok(None),
        }
    }

    async fn delete_old_snapshots(&self, before_date: &str) -> Result<u32> {
        let filter = doc! { "date": { "$lt": before_date } };
        let result =
            self.snapshots.delete_many(filter).await.map_err(|e| {
                DeFi10Error::Database(format!("Failed to delete old snapshots: {}", e))
            })?;
        Ok(result.deleted_count as u32)
    }

    async fn delete_old_analytics(&self, before_date: &str) -> Result<u32> {
        let filter = doc! { "date": { "$lt": before_date } };
        let result =
            self.analytics.delete_many(filter).await.map_err(|e| {
                DeFi10Error::Database(format!("Failed to delete old analytics: {}", e))
            })?;
        Ok(result.deleted_count as u32)
    }

    async fn delete_old_sync_snapshots(&self, before_date: &str) -> Result<u32> {
        let filter = doc! { "date": { "$lt": before_date } };
        let result = self.sync_snapshots.delete_many(filter).await.map_err(|e| {
            DeFi10Error::Database(format!("Failed to delete old sync snapshots: {}", e))
        })?;
        Ok(result.deleted_count as u32)
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotPartial {
    date: String,
    total_value_usd: f64,
    summary: SnapshotSummary,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsPartial {
    date: String,
    daily_pnl: f64,
    daily_pnl_percent: f64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotWithPositions {
    date: String,
    positions: Vec<PositionPartial>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PositionPartial {
    token_symbol: String,
    balance: f64,
    value_usd: f64,
    price_usd: f64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct TotalOnly {
    total_value_usd: f64,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WalletGroupIdOnly {
    wallet_group_id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncSummaryPartial {
    #[serde(rename = "_id")]
    id: String,
    wallet_group_id: String,
    date: String,
    synced_at: chrono::DateTime<chrono::Utc>,
    total_value_usd: f64,
    summary: SnapshotSummary,
}
