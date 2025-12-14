# CI/CD Testing Configuration

This repository uses GitHub Actions for automated testing, code coverage, and continuous integration.

## Workflows

### 1. Test & Coverage (`test.yml`)
**Triggers:** Pull requests and pushes to `main` and `develop` branches

**Features:**
- ✅ Runs unit tests on all PRs (filters out integration tests)
- ✅ Runs full test suite on main/develop branch pushes
- ✅ Collects code coverage using Coverlet
- ✅ Generates coverage reports (Cobertura, LCOV, HTML)
- ✅ Adds coverage summary as PR comment
- ✅ Uploads test results and coverage artifacts
- ✅ Fails the build if tests fail

**Test Filtering:**
- PRs: Only unit tests (`--filter "Category!=Integration&Category!=E2E"`)
- Main/Develop: Only unit tests (`--filter "Category!=Integration&Category!=E2E"`)

### 2. Integration Tests (`test.yml` - separate job)
**Triggers:** Pushes to `main` branch and manual workflow dispatch

**Features:**
- Runs integration and E2E tests
- Only executes on main branch to save CI time
- Separate job with longer timeout (30 minutes)

### 3. Nightly Tests (`nightly.yml`)
**Triggers:** Daily at 2 AM UTC, manual workflow dispatch

**Features:**
- Comprehensive test suite with all tests
- Detailed coverage reports with multiple formats
- Creates GitHub issue on failure
- 90-day artifact retention

## Test Categories

To enable test filtering, add traits to your test methods:

```csharp
// Unit test (default, no trait needed)
[Fact]
public void MyUnitTest() { }

// Integration test (filtered out on PRs)
[Fact]
[Trait("Category", "Integration")]
public void MyIntegrationTest() { }

// E2E test (filtered out on PRs)
[Fact]
[Trait("Category", "E2E")]
public void MyE2ETest() { }
```

## Branch Protection Setup

To require tests to pass before merging, configure branch protection rules:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Click **Add rule** for `main` branch
3. Configure the following settings:

### Required Settings:
- ✅ **Require a pull request before merging**
  - Require approvals: 1
  - Dismiss stale pull request approvals when new commits are pushed
  
- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date before merging
  - **Status checks that are required:**
    - `Run Tests`
    - Add other checks as needed

- ✅ **Require conversation resolution before merging**

- ✅ **Do not allow bypassing the above settings**

### Optional Settings:
- Require signed commits
- Require linear history
- Include administrators (if you want to enforce for admins too)

## Coverage Badges

Add the following badges to your main README.md:

```markdown
![Tests](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/test.yml/badge.svg)
![Coverage](https://img.shields.io/badge/Coverage-Check%20Artifacts-blue)
```

For a dynamic coverage badge, consider using:
- [Codecov](https://codecov.io/)
- [Coveralls](https://coveralls.io/)
- [Codacy](https://www.codacy.com/)

## Running Tests Locally

### All Tests
```bash
dotnet test --configuration Release
```

### With Coverage
```bash
dotnet test \
  --configuration Release \
  --collect:"XPlat Code Coverage" \
  --results-directory ./TestResults \
  -- DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Format=cobertura
```

### Unit Tests Only
```bash
dotnet test \
  --configuration Release \
  --filter "Category!=Integration&Category!=E2E"
```

### Integration Tests Only
```bash
dotnet test \
  --configuration Release \
  --filter "Category=Integration|Category=E2E"
```

## Coverage Reports

After running tests with coverage locally:

### Install ReportGenerator
```bash
dotnet tool install -g dotnet-reportgenerator-globaltool
```

### Generate HTML Report
```bash
reportgenerator \
  -reports:"TestResults/**/coverage.cobertura.xml" \
  -targetdir:"CoverageReport" \
  -reporttypes:"Html"
```

### View Report
```bash
# Windows
start CoverageReport/index.html

# macOS
open CoverageReport/index.html

# Linux
xdg-open CoverageReport/index.html
```

## Coverage Threshold

The CI workflow includes a coverage threshold check. By default, it's set to 0% to avoid blocking builds initially. 

To enforce a minimum coverage percentage:

Edit `.github/workflows/test.yml` and update this line:
```powershell
$threshold = 0  # Change to desired percentage (e.g., 70 for 70%)
```

## Artifacts

Test results and coverage reports are uploaded as workflow artifacts and retained for:
- **Regular tests:** 30 days
- **Nightly tests:** 90 days

Download artifacts from:
- Workflow run page → Artifacts section
- Or use GitHub CLI: `gh run download <run-id>`

## Troubleshooting

### Tests pass locally but fail in CI
- Check for environment-specific dependencies
- Verify appsettings.json is properly configured
- Check test isolation issues

### Coverage not generated
- Ensure `coverlet.collector` package is installed
- Check that tests are actually running
- Verify `--collect:"XPlat Code Coverage"` flag is used

### Integration tests failing on PRs
- They should be filtered out with the `Category!=Integration` filter
- Add `[Trait("Category", "Integration")]` to integration tests

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [dotnet test Documentation](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-test)
- [Coverlet Documentation](https://github.com/coverlet-coverage/coverlet)
- [ReportGenerator Documentation](https://github.com/danielpalme/ReportGenerator)
