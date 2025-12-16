# DeFi10.API.Tests

Integration and unit tests for the DeFi10 API.

## Setup

### Configuration

Tests that interact with blockchain networks require configuration. Create an `appsettings.json` file in this directory with your test data:

```bash
cp appsettings.example.json appsettings.json
```

Then edit `appsettings.json` with your test wallet addresses and other required values.

**Important:** The `appsettings.json` file is git-ignored to prevent committing sensitive wallet addresses. Never commit this file to version control.
