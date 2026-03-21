pub mod evm;
pub mod solana;
pub mod traits;

pub use solana::{SolanaProvider, SplTokenAccount};
pub use traits::{BlockchainProvider, TokenBalance, TransactionStatus};

use defi10_core::Result;
