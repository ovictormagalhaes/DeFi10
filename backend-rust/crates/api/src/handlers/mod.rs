pub mod aggregations;
pub mod auth;
pub mod health;
pub mod history;
pub mod image_proxy;
pub mod pow;
pub mod proxy;
pub mod strategies;
pub mod tokens;
pub mod wallet;
pub mod wallet_groups;
pub mod wallet_item;

pub use aggregations::{get_job_status, start_aggregation};
pub use health::health_check;
pub use wallet::get_supported_chains;

use crate::middleware::auth::AuthUser;
use defi10_core::DeFi10Error;

pub fn verify_user_access(user: &AuthUser, requested_id: &str) -> Result<(), DeFi10Error> {
    if user.user_id != requested_id {
        tracing::warn!(
            "ID mismatch: token={}, requested={}",
            user.user_id,
            requested_id
        );
        return Err(DeFi10Error::Forbidden("Access denied".to_string()));
    }
    Ok(())
}
