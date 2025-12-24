# DeFi10.API.IntegrationTests

Integration tests for the DeFi10 API. These tests require external dependencies and environment configuration.

## Setup

### Configuration

Integration tests require configuration for blockchain networks and external services. Create an `appsettings.json` file in this directory:

```bash
cp appsettings.example.json appsettings.json
```

Then edit `appsettings.json` with your test wallet addresses and API keys.

**Important:** The `appsettings.json` file is git-ignored to prevent committing sensitive data. Never commit this file to version control.

## Running Tests

These tests are NOT run by default in CI/CD pipelines as they require external dependencies.

To run integration tests locally:

```bash
dotnet test DeFi10.API.IntegrationTests
```

## Test Categories

All tests in this project are marked with `[Trait("Category", "Integration")]` and include:

- Kamino protocol integration tests
- Raydium protocol integration tests  
- Blockchain RPC integration tests
- External API integration tests
