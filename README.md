# DeFi10 API

> **Multi-chain DeFi Portfolio Aggregation Engine**  
> Event-driven API for real-time aggregation of DeFi positions across multiple blockchains.

[![.NET 9](https://img.shields.io/badge/.NET-9.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![C# 13](https://img.shields.io/badge/C%23-13.0-239120?logo=csharp)](https://docs.microsoft.com/en-us/dotnet/csharp/)

---

## Overview

DeFi10 aggregates DeFi positions from multiple protocols and blockchains into a unified portfolio view.

**Supported Chains:**
- EVM: Ethereum, Base, Arbitrum, BNB Smart Chain
- Solana

**Integrated Protocols:**
- Uniswap V3, Aave V3, Pendle V2
- Raydium, Kamino
- Token balances & NFTs via Moralis

---

## Architecture

```
REST API → RabbitMQ → Workers → External APIs (Alchemy, Moralis)
                ↓
        Cache (Redis) + Storage (MongoDB)
```

**Key Patterns:**
- Event-driven architecture (RabbitMQ pub/sub)
- Intelligent retry with exponential backoff
- Distributed caching for prices and metadata
- Stateless workers for horizontal scaling

---

## Quick Start

### Prerequisites
- .NET 9 SDK
- Redis, MongoDB, RabbitMQ

### Run API Tests (E2E)

Complete automated API testing with Docker:

```powershell
cd backend\api-e2e-tests-csharp
.\run-tests.ps1
```

**What it does:**
- ✅ Spins up API + MongoDB + Redis in Docker
- ✅ Runs 100+ test cases covering all endpoints
- ✅ Validates authentication, validation, and business logic
- ✅ Generates coverage reports

See [backend/api-e2e-tests-csharp/README.md](backend/api-e2e-tests-csharp/README.md) for details.

### Run Locally

```bash
git clone https://github.com/ovictormagalhaes/Defi10.git
cd Defi10/backend/DeFi10.API

# Restore dependencies
dotnet restore

# Configure required secrets
dotnet user-secrets set "Alchemy:ApiKey" "your-key"
dotnet user-secrets set "Moralis:ApiKey" "your-key"
dotnet user-secrets set "Redis:ConnectionString" "localhost:6379"
dotnet user-secrets set "MongoDB:ConnectionString" "mongodb://localhost:27017"
dotnet user-secrets set "RabbitMQ:Host" "localhost"
dotnet user-secrets set "Jwt:Secret" "your-256-bit-secret"

# Start
dotnet run
```

**API:** `http://localhost:10000`  
**Swagger:** `http://localhost:10000/swagger`

---

## Configuration

Configuration is done via `appsettings.json` and environment variables.

**Required services:**
- Alchemy (RPC)
- Moralis (tokens/NFTs)
- Redis (cache)
- MongoDB (storage)
- RabbitMQ (messaging)
- CoinMarketCap (price enrichment)

See [appsettings.json](backend/DeFi10.API/appsettings.json) for full configuration structure.


### Testing

```bash
dotnet test                              # Run all tests
dotnet test /p:CollectCoverage=true     # With coverage
```

---

## Docker

```bash
docker build -t defi10-api:latest .
docker-compose up -d
```

See [docker-compose.yml](docker-compose.yml) for full setup.

---

## Support

- **Issues:** [GitHub Issues](https://github.com/ovictormagalhaes/Defi10/issues)
- **Discussions:** [GitHub Discussions](https://github.com/ovictormagalhaes/Defi10/discussions)

---

## License

MIT License - [LICENSE](LICENSE)

---

<div align="center">

**Built with .NET 9**

</div>
