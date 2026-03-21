# DeFi10 Backend - Rust Implementation

High-performance Rust backend for DeFi10, supporting multiple DeFi protocols across EVM and Solana blockchains.

## Architecture

- **core**: Domain models, traits, and error types
- **infrastructure**: Database, cache, messaging, and configuration
- **blockchain**: EVM and Solana blockchain integrations
- **protocols**: Protocol-specific implementations (Aave, Uniswap, Kamino, etc.)
- **aggregation**: Cross-protocol data aggregation services
- **api**: REST API endpoints and HTTP server

## Tech Stack

- **Runtime**: Tokio async runtime
- **Web**: Axum web framework
- **Database**: MongoDB
- **Cache**: Redis
- **Messaging**: RabbitMQ (via lapin)
- **Blockchain**: ethers-rs (EVM), solana-client (Solana)
- **Testing**: testcontainers, wiremock, cargo-nextest

## Development

### Prerequisites

- Rust 1.75+
- Docker & Docker Compose
- MongoDB, Redis, RabbitMQ (via docker-compose)

### Setup

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build all crates
cargo build

# Run tests with coverage
cargo test
cargo tarpaulin --out Html --out Lcov

# Run the API server
cargo run --bin defi10-api
```

### Running with Docker

```bash
# Start infrastructure services
docker-compose up -d mongo redis rabbitmq

# Build and run API
docker build -t defi10-backend .
docker run -p 10000:10000 defi10-backend
```

## Testing

All modules include comprehensive unit and integration tests:

```bash
# Run all tests
cargo test

# Run with coverage report
cargo tarpaulin --workspace --out Html

# Run specific crate tests
cargo test -p defi10-core
cargo test -p defi10-api

# Integration tests only
cargo test --test '*'
```

## Configuration

Configuration is loaded from environment variables and config files:

- `.env` - Local development
- `config/default.toml` - Default configuration
- `config/production.toml` - Production overrides

Key environment variables:
- `MONGODB_URI`
- `REDIS_URL`
- `RABBITMQ_URL`
- `JWT_SECRET`
- `ALCHEMY_API_KEY`
- `SOLANA_RPC_URL`

## License

MIT
