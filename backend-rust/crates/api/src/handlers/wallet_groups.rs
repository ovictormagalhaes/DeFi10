use axum::{
    extract::{Path, State},
    http::{Extensions, StatusCode},
    Json,
};
use defi10_core::{
    CreateWalletGroupRequest, DeFi10Error, UpdateWalletGroupRequest, WalletGroup,
    WalletGroupResponse,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::{middleware::AuthUser, state::AppState};

fn verify_group_ownership(group: &WalletGroup, user_id: &str, action: &str) -> Result<(), DeFi10Error> {
    if let Some(ref owner_id) = group.user_id {
        if owner_id != user_id {
            return Err(DeFi10Error::Forbidden(
                format!("You don't have permission to {} this wallet group", action),
            ));
        }
    }
    Ok(())
}

pub async fn create_wallet_group(
    State(state): State<Arc<AppState>>,
    extensions: Extensions,
    Json(req): Json<CreateWalletGroupRequest>,
) -> Result<(StatusCode, Json<WalletGroupResponse>), DeFi10Error> {
    let auth_user = extensions.get::<AuthUser>();

    tracing::info!(
        "Creating wallet group: {:?} for user: {:?}",
        req.display_name,
        auth_user.map(|u| &u.user_id)
    );

    if req.wallets.is_empty() {
        return Err(DeFi10Error::Validation(
            "At least one wallet is required".to_string(),
        ));
    }

    let user_id = auth_user.map(|u| u.user_id.clone());

    let group = WalletGroup::new(req.display_name, req.wallets, user_id);

    state.wallet_group_repo.create(&group).await?;

    tracing::info!("Wallet group created: {}", group.id);

    Ok((StatusCode::CREATED, Json(group.into())))
}

pub async fn get_wallet_group(
    State(state): State<Arc<AppState>>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
) -> Result<Json<WalletGroupResponse>, DeFi10Error> {
    let auth_user = extensions
        .get::<AuthUser>()
        .ok_or_else(|| DeFi10Error::Unauthorized("Authentication required".to_string()))?;

    tracing::debug!(
        "Getting wallet group: {} for user: {}",
        id,
        auth_user.user_id
    );

    let group = state
        .wallet_group_repo
        .get(&id)
        .await?
        .ok_or_else(|| DeFi10Error::NotFound(format!("Wallet group {} not found", id)))?;

    verify_group_ownership(&group, &auth_user.user_id, "access")?;

    Ok(Json(group.into()))
}

pub async fn list_wallet_groups(
    State(state): State<Arc<AppState>>,
    extensions: Extensions,
) -> Result<Json<Vec<WalletGroupResponse>>, DeFi10Error> {
    let auth_user = extensions
        .get::<AuthUser>()
        .ok_or_else(|| DeFi10Error::Unauthorized("Authentication required".to_string()))?;

    tracing::debug!("Listing wallet groups for user: {}", auth_user.user_id);

    let groups = state
        .wallet_group_repo
        .list(Some(&auth_user.user_id))
        .await?;

    let responses: Vec<WalletGroupResponse> = groups.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

pub async fn update_wallet_group(
    State(state): State<Arc<AppState>>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateWalletGroupRequest>,
) -> Result<Json<WalletGroupResponse>, DeFi10Error> {
    let auth_user = extensions
        .get::<AuthUser>()
        .ok_or_else(|| DeFi10Error::Unauthorized("Authentication required".to_string()))?;

    tracing::info!(
        "Updating wallet group: {} for user: {}",
        id,
        auth_user.user_id
    );

    let mut group = state
        .wallet_group_repo
        .get(&id)
        .await?
        .ok_or_else(|| DeFi10Error::NotFound(format!("Wallet group {} not found", id)))?;

    verify_group_ownership(&group, &auth_user.user_id, "update")?;

    if let Some(ref wallets) = req.wallets {
        if wallets.is_empty() {
            return Err(DeFi10Error::Validation(
                "At least one wallet is required".to_string(),
            ));
        }
    }

    group.update(req.display_name, req.wallets);

    state.wallet_group_repo.update(&group).await?;

    tracing::info!("Wallet group updated: {}", id);

    Ok(Json(group.into()))
}

pub async fn delete_wallet_group(
    State(state): State<Arc<AppState>>,
    extensions: Extensions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, DeFi10Error> {
    let auth_user = extensions
        .get::<AuthUser>()
        .ok_or_else(|| DeFi10Error::Unauthorized("Authentication required".to_string()))?;

    tracing::info!(
        "Deleting wallet group: {} for user: {}",
        id,
        auth_user.user_id
    );

    let group = state
        .wallet_group_repo
        .get(&id)
        .await?
        .ok_or_else(|| DeFi10Error::NotFound(format!("Wallet group {} not found", id)))?;

    verify_group_ownership(&group, &auth_user.user_id, "delete")?;

    let deleted = state.wallet_group_repo.delete(&id).await?;

    if !deleted {
        return Err(DeFi10Error::NotFound(format!(
            "Wallet group {} not found",
            id
        )));
    }

    tracing::info!("Wallet group deleted: {}", id);

    Ok(StatusCode::NO_CONTENT)
}

use crate::middleware::generate_wallet_group_token;
use defi10_core::{ConnectRequest, ConnectResponse};

pub async fn connect_wallet_group(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<ConnectRequest>,
) -> Result<Json<ConnectResponse>, DeFi10Error> {
    tracing::info!("Connection attempt to wallet group: {}", id);

    let group = state.wallet_group_repo.get(&id).await?.ok_or_else(|| {
        tracing::warn!("Connection attempt to non-existent wallet group {}", id);
        DeFi10Error::NotFound(format!("Wallet group {} not found", id))
    })?;

    if let Some(ref password_hash) = group.password_hash {
        if !password_hash.is_empty() {
            let password = req.password.as_deref().unwrap_or("");
            if password.is_empty() {
                tracing::warn!(
                    "Connection attempt without password for wallet group {}",
                    id
                );
                return Err(DeFi10Error::Unauthorized("Invalid credentials".to_string()));
            }

            let is_valid = bcrypt::verify(password, password_hash).unwrap_or(false);
            if !is_valid {
                tracing::warn!("Invalid password attempt for wallet group {}", id);
                return Err(DeFi10Error::Unauthorized("Invalid credentials".to_string()));
            }
        }
    }

    let token_data = generate_wallet_group_token(
        group.id,
        group.display_name.clone(),
        &state.config.jwt.secret,
        state.config.jwt.expiration_hours * 60,
    )?;

    tracing::info!("Generated JWT token for wallet group {}", id);

    Ok(Json(ConnectResponse {
        token: token_data.token,
        wallet_group_id: group.id,
        expires_at: token_data.expires_at,
        wallets: group.wallets.clone(),
        display_name: group.display_name,
        has_password: group
            .password_hash
            .as_ref()
            .map(|h| !h.is_empty())
            .unwrap_or(false),
        created_at: group.created_at,
        updated_at: group.updated_at,
    }))
}

#[cfg(test)]
mod tests {
    use defi10_core::WalletGroup;
    use uuid::Uuid;

    #[test]
    fn test_wallet_group_creation() {
        let group = WalletGroup::new(
            Some("Test Group".to_string()),
            vec!["0x1234".to_string(), "0x5678".to_string()],
            Some("user123".to_string()),
        );

        assert_eq!(group.display_name, Some("Test Group".to_string()));
        assert_eq!(group.wallets.len(), 2);
        assert_eq!(group.user_id, Some("user123".to_string()));
        assert!(!group.id.is_nil());
    }

    #[test]
    fn test_wallet_group_id_is_valid_uuid() {
        let group = WalletGroup::new(None, vec!["0xabcd".to_string()], None);

        let id_str = group.id.to_string();
        let parsed = Uuid::parse_str(&id_str);
        assert!(parsed.is_ok());
    }
}
