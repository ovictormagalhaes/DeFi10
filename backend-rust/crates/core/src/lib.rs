pub mod aggregation;
pub mod chain;
pub mod error;
#[cfg(feature = "http")]
pub mod http_helpers;
pub mod pow;
pub mod protocol;
pub mod strategy;
pub mod token_decimals;
pub mod types;
pub mod wallet_group;

pub use aggregation::is_chain_compatible;
pub use chain::Chain;
pub use error::{DeFi10Error, Result};
pub use pow::{Challenge, ChallengeData, ProofRequest, ProofResponse};
pub use protocol::Protocol;
pub use strategy::{
    AllocationChain, AllocationProtocol, AllocationToken, HealthFactorTarget,
    SaveStrategiesRequest, SaveStrategiesResponse, StrategyAllocation, StrategyDocument,
    StrategyRequest, StrategySummary, StrategyType, WalletGroupStrategies,
    WalletGroupStrategiesResponse,
};
pub use wallet_group::{
    ConnectRequest, ConnectResponse, CreateWalletGroupRequest, UpdateWalletGroupRequest,
    WalletGroup, WalletGroupResponse,
};
