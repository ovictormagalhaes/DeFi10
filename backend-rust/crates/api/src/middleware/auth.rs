use crate::state::AppState;
use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // user_id
    pub email: Option<String>,
    pub exp: usize, // expiration timestamp
    pub iat: usize, // issued at timestamp
}

/// Extension to carry authenticated user info through request
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    #[allow(dead_code)]
    pub email: Option<String>,
}

/// JWT authentication middleware
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Check for Bearer token
    if !auth_header.starts_with("Bearer ") {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = &auth_header[7..]; // Remove "Bearer " prefix

    // Validate JWT
    let secret = &state.config.jwt.secret;
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|e| {
        tracing::warn!("JWT validation failed: {}", e);
        StatusCode::UNAUTHORIZED
    })?;

    // Add user info to request extensions
    let auth_user = AuthUser {
        user_id: token_data.claims.sub.clone(),
        email: token_data.claims.email.clone(),
    };

    request.extensions_mut().insert(auth_user);

    Ok(next.run(request).await)
}

/// Optional JWT authentication middleware - allows requests without token
/// but extracts user info if token is present
pub async fn optional_auth_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    // Try to extract Authorization header
    if let Some(auth_header) = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
    {
        // Check for Bearer token
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            let secret = &state.config.jwt.secret;
            if let Ok(token_data) = decode::<Claims>(
                token,
                &DecodingKey::from_secret(secret.as_ref()),
                &Validation::new(Algorithm::HS256),
            ) {
                let auth_user = AuthUser {
                    user_id: token_data.claims.sub.clone(),
                    email: token_data.claims.email.clone(),
                };
                request.extensions_mut().insert(auth_user);
            } else {
                tracing::warn!("Invalid JWT token provided, continuing without authentication");
            }
        }
    }

    // Continue without requiring authentication
    next.run(request).await
}

use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use uuid::Uuid;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct WalletGroupClaims {
    pub sub: String,
    pub name: Option<String>,
    pub exp: usize,
    pub iat: usize,
}

pub struct WalletGroupToken {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

pub fn generate_wallet_group_token(
    wallet_group_id: Uuid,
    display_name: Option<String>,
    secret: &str,
    expiration_minutes: i64,
) -> Result<WalletGroupToken, defi10_core::DeFi10Error> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| defi10_core::DeFi10Error::Internal(format!("System time error: {}", e)))?
        .as_secs() as usize;

    let exp = now + (expiration_minutes as usize * 60);
    let expires_at = Utc::now() + Duration::minutes(expiration_minutes);

    let claims = WalletGroupClaims {
        sub: wallet_group_id.to_string(),
        name: display_name,
        exp,
        iat: now,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| defi10_core::DeFi10Error::Internal(format!("JWT encoding failed: {}", e)))?;

    Ok(WalletGroupToken { token, expires_at })
}

pub fn generate_wallet_token(
    address: &str,
    secret: &str,
    expiration_days: i64,
) -> Result<WalletGroupToken, defi10_core::DeFi10Error> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let expiration_minutes = expiration_days * 24 * 60;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| defi10_core::DeFi10Error::Internal(format!("System time error: {}", e)))?
        .as_secs() as usize;

    let exp = now + (expiration_minutes as usize * 60);
    let expires_at = Utc::now() + Duration::minutes(expiration_minutes);

    let claims = WalletGroupClaims {
        sub: address.to_string(),
        name: None,
        exp,
        iat: now,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|e| defi10_core::DeFi10Error::Internal(format!("JWT encoding failed: {}", e)))?;

    Ok(WalletGroupToken { token, expires_at })
}

/// Helper to generate JWT token (for testing/development)
#[cfg(test)]
pub fn generate_test_token(user_id: &str, secret: &str) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        email: Some(format!("{}@test.com", user_id)),
        exp: now + 3600,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_test_token_creates_valid_token() {
        use jsonwebtoken::{decode, DecodingKey, Validation};

        let secret = "test-secret";
        let user_id = "user123";
        let token = generate_test_token(user_id, secret);

        let token_data = decode::<Claims>(
            &token,
            &DecodingKey::from_secret(secret.as_ref()),
            &Validation::default(),
        );

        assert!(token_data.is_ok());
        let claims = token_data.unwrap().claims;
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.email, Some(format!("{}@test.com", user_id)));
    }

    #[test]
    fn test_claims_serialization() {
        let claims = Claims {
            sub: "user123".to_string(),
            email: Some("user@test.com".to_string()),
            exp: 1234567890,
            iat: 1234567800,
        };

        assert_eq!(claims.sub, "user123");
        assert_eq!(claims.email, Some("user@test.com".to_string()));
    }
}
