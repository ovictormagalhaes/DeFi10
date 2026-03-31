use anyhow::Result;
use chrono::Utc;
use defi10_core::strategy::{
    StrategyDocument, StrategyRequest, StrategyType, WalletGroupStrategies,
};
use mongodb::{
    bson::{doc, to_document, Document},
    options::ReplaceOptions,
    Collection, Database,
};
use uuid::Uuid;

pub struct StrategyService {
    collection: Collection<WalletGroupStrategies>,
    raw_collection: Collection<Document>,
}

impl StrategyService {
    pub fn new(database: &Database) -> Self {
        Self {
            collection: database.collection("strategies"),
            raw_collection: database.collection("strategies"),
        }
    }

    pub async fn save_strategies(
        &self,
        wallet_group_id: Uuid,
        accounts: Vec<String>,
        strategies: Vec<StrategyRequest>,
    ) -> Result<WalletGroupStrategies> {
        for strategy in &strategies {
            self.validate_strategy(strategy)?;
        }

        let now = Utc::now();

        let strategy_docs: Vec<StrategyDocument> = strategies
            .into_iter()
            .map(|req| StrategyDocument {
                id: req.id.unwrap_or_else(Uuid::new_v4),
                strategy_type: req.strategy_type,
                name: req.name,
                description: req.description,
                allocations: req.allocations,
                targets: req.targets,
                created_at: req.created_at.unwrap_or(now),
                updated_at: now,
            })
            .collect();

        let wallet_group_strategies =
            WalletGroupStrategies::new(wallet_group_id, accounts, strategy_docs);

        self.collection
            .replace_one(
                doc! { "_id": wallet_group_id.to_string() },
                &wallet_group_strategies,
            )
            .upsert(true)
            .await?;

        tracing::info!(
            "Saved {} strategies for wallet_group_id={}",
            wallet_group_strategies.strategies.len(),
            wallet_group_id
        );

        Ok(wallet_group_strategies)
    }

    pub async fn get_strategies(
        &self,
        wallet_group_id: Uuid,
    ) -> Result<Option<WalletGroupStrategies>> {
        let result = self
            .collection
            .find_one(doc! { "_id": wallet_group_id.to_string() })
            .await?;

        Ok(result)
    }

    pub async fn get_strategies_by_key(&self, key: &str) -> Result<Option<WalletGroupStrategies>> {
        let doc = self.raw_collection.find_one(doc! { "_id": key }).await?;

        match doc {
            Some(d) => {
                let mut wgs: WalletGroupStrategies =
                    mongodb::bson::from_document(d).unwrap_or_else(|_| {
                        WalletGroupStrategies::new(Uuid::nil(), vec![key.to_string()], vec![])
                    });
                wgs.key = key.to_string();
                Ok(Some(wgs))
            }
            None => Ok(None),
        }
    }

    pub async fn save_strategies_by_key(
        &self,
        key: &str,
        wallets: Vec<String>,
        strategies: Vec<StrategyRequest>,
    ) -> Result<WalletGroupStrategies> {
        for strategy in &strategies {
            self.validate_strategy(strategy)?;
        }

        let now = Utc::now();

        let strategy_docs: Vec<StrategyDocument> = strategies
            .into_iter()
            .map(|req| StrategyDocument {
                id: req.id.unwrap_or_else(Uuid::new_v4),
                strategy_type: req.strategy_type,
                name: req.name,
                description: req.description,
                allocations: req.allocations,
                targets: req.targets,
                created_at: req.created_at.unwrap_or(now),
                updated_at: now,
            })
            .collect();

        let wallet_group_id = Uuid::nil();
        let mut wallet_group_strategies =
            WalletGroupStrategies::new(wallet_group_id, wallets, strategy_docs);
        wallet_group_strategies.key = key.to_string();

        let mut doc = to_document(&wallet_group_strategies)?;
        doc.insert("_id", key);

        let options = ReplaceOptions::builder().upsert(true).build();
        self.raw_collection
            .replace_one(doc! { "_id": key }, doc)
            .with_options(options)
            .await?;

        tracing::info!(
            "Saved {} strategies for key={}",
            wallet_group_strategies.strategies.len(),
            key
        );

        Ok(wallet_group_strategies)
    }

    fn validate_strategy(&self, strategy: &StrategyRequest) -> Result<()> {
        match strategy.strategy_type {
            StrategyType::AllocationByWeight => {
                let allocations = strategy.allocations.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("Allocations are required for AllocationByWeight strategy")
                })?;

                if allocations.is_empty() {
                    return Err(anyhow::anyhow!(
                        "Allocations cannot be empty for AllocationByWeight strategy"
                    ));
                }

                for allocation in allocations {
                    if allocation.asset_key.trim().is_empty() {
                        return Err(anyhow::anyhow!("AssetKey is required for each allocation"));
                    }

                    if !(0..=100).contains(&allocation.target_weight) {
                        return Err(anyhow::anyhow!(
                            "TargetWeight must be between 0 and 100, got {}",
                            allocation.target_weight
                        ));
                    }
                }
            }
            StrategyType::HealthFactorTarget => {
                let targets = strategy.targets.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("Targets are required for HealthFactorTarget strategy")
                })?;

                if targets.is_empty() {
                    return Err(anyhow::anyhow!(
                        "Targets cannot be empty for HealthFactorTarget strategy"
                    ));
                }

                for target in targets {
                    if target.asset_key.trim().is_empty() {
                        return Err(anyhow::anyhow!("AssetKey is required for each target"));
                    }

                    if target.target_health_factor <= 0.0 {
                        return Err(anyhow::anyhow!(
                            "TargetHealthFactor must be positive, got {}",
                            target.target_health_factor
                        ));
                    }

                    if target.critical_threshold <= 0.0
                        || target.critical_threshold > target.target_health_factor
                    {
                        return Err(anyhow::anyhow!(
                            "CriticalThreshold must be positive and less than or equal to TargetHealthFactor"
                        ));
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use defi10_core::strategy::{
        AllocationChain, AllocationProtocol, AllocationToken, StrategyAllocation,
    };

    fn validate_strategy_test(strategy: &StrategyRequest) -> Result<()> {
        match strategy.strategy_type {
            StrategyType::AllocationByWeight => {
                if let Some(ref allocations) = strategy.allocations {
                    if allocations.is_empty() {
                        return Err(anyhow::anyhow!(
                            "Allocations must not be empty for AllocationByWeight strategy"
                        ));
                    }
                    for alloc in allocations {
                        if alloc.target_weight < 0 || alloc.target_weight > 100 {
                            return Err(anyhow::anyhow!(
                                "Invalid target weight: {} for asset {}. Must be between 0 and 100",
                                alloc.target_weight,
                                alloc.asset_key
                            ));
                        }
                    }
                } else {
                    return Err(anyhow::anyhow!(
                        "Allocations are required for AllocationByWeight strategy"
                    ));
                }
            }
            StrategyType::HealthFactorTarget => {
                if strategy.targets.is_none() {
                    return Err(anyhow::anyhow!(
                        "Targets are required for HealthFactorTarget strategy"
                    ));
                }
            }
        }
        Ok(())
    }

    fn make_test_allocation(asset_key: &str, target_weight: i32) -> StrategyAllocation {
        StrategyAllocation {
            asset_key: asset_key.to_string(),
            protocol: AllocationProtocol {
                id: "aave-v3".to_string(),
                name: "Aave V3".to_string(),
                logo: None,
            },
            chain: AllocationChain {
                id: "base".to_string(),
                name: "Base".to_string(),
                logo: None,
            },
            token: AllocationToken {
                symbol: asset_key.to_string(),
                name: asset_key.to_string(),
                address: "0x0".to_string(),
                logo: None,
            },
            group: "Lending Supply".to_string(),
            group_type: 10,
            target_weight,
            position_type: 1,
        }
    }

    #[test]
    fn test_validate_allocation_strategy_success() {
        let strategy = StrategyRequest {
            id: None,
            strategy_type: StrategyType::AllocationByWeight,
            name: Some("Test Strategy".to_string()),
            description: None,
            allocations: Some(vec![make_test_allocation("BTC", 50)]),
            targets: None,
            created_at: None,
        };

        assert!(validate_strategy_test(&strategy).is_ok());
    }

    #[test]
    fn test_validate_allocation_strategy_empty_allocations() {
        let strategy = StrategyRequest {
            id: None,
            strategy_type: StrategyType::AllocationByWeight,
            name: Some("Test Strategy".to_string()),
            description: None,
            allocations: Some(vec![]),
            targets: None,
            created_at: None,
        };

        assert!(validate_strategy_test(&strategy).is_err());
    }

    #[test]
    fn test_validate_allocation_strategy_invalid_weight() {
        let strategy = StrategyRequest {
            id: None,
            strategy_type: StrategyType::AllocationByWeight,
            name: Some("Test Strategy".to_string()),
            description: None,
            allocations: Some(vec![make_test_allocation("BTC", 150)]),
            targets: None,
            created_at: None,
        };

        assert!(validate_strategy_test(&strategy).is_err());
    }
}
