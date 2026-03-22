# Build stage
FROM rust:1.92-slim as builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates/core/Cargo.toml crates/core/Cargo.toml
COPY crates/blockchain/Cargo.toml crates/blockchain/Cargo.toml
COPY crates/infrastructure/Cargo.toml crates/infrastructure/Cargo.toml
COPY crates/protocols/Cargo.toml crates/protocols/Cargo.toml
COPY crates/aggregation/Cargo.toml crates/aggregation/Cargo.toml
COPY crates/worker/Cargo.toml crates/worker/Cargo.toml
COPY crates/api/Cargo.toml crates/api/Cargo.toml

RUN mkdir -p crates/core/src && echo "" > crates/core/src/lib.rs && \
    mkdir -p crates/blockchain/src && echo "" > crates/blockchain/src/lib.rs && \
    mkdir -p crates/infrastructure/src && echo "" > crates/infrastructure/src/lib.rs && \
    mkdir -p crates/infrastructure/src/bin && echo "fn main() {}" > crates/infrastructure/src/bin/migrate_strategies.rs && \
    mkdir -p crates/protocols/src && echo "" > crates/protocols/src/lib.rs && \
    mkdir -p crates/aggregation/src && echo "" > crates/aggregation/src/lib.rs && \
    mkdir -p crates/worker/src && echo "fn main() {}" > crates/worker/src/main.rs && \
    mkdir -p crates/api/src && echo "fn main() {}" > crates/api/src/main.rs

RUN cargo build --release --bin defi10-api 2>/dev/null || true

COPY crates ./crates
RUN touch crates/*/src/lib.rs crates/*/src/main.rs 2>/dev/null || true

RUN cargo build --release --bin defi10-api

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/defi10-api /app/defi10-api

# Expose port
EXPOSE 10000

# Set environment
ENV RUST_LOG=info

# Run the application
CMD ["/app/defi10-api"]
