using Xunit;

namespace DeFi10.API.Tests
{
    public class ExampleCategorizedTests
    {
        // ============================================================
        // UNIT TESTS (No trait - runs on PRs)
        // ============================================================

        [Fact]
        public void UnitTest_Example_ShouldPass()
        {
            // Arrange
            var value = 2 + 2;
            
            // Act & Assert
            Assert.Equal(4, value);
        }

        [Theory]
        [InlineData(1, 1, 2)]
        [InlineData(2, 3, 5)]
        [InlineData(-1, 1, 0)]
        public void UnitTest_Addition_ShouldReturnCorrectSum(int a, int b, int expected)
        {
            // Arrange & Act
            var result = a + b;
            
            // Assert
            Assert.Equal(expected, result);
        }

        // ============================================================
        // INTEGRATION TESTS (Filtered out on PRs)
        // ============================================================

        [Fact]
        [Trait("Category", "Integration")]
        public void IntegrationTest_Database_ShouldConnect()
        {
            // This test requires external dependencies (database, APIs, etc.)
            
            Assert.True(true, "Integration test placeholder");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public void IntegrationTest_ExternalAPI_ShouldReturnData()
        {
            // This test makes real API calls      
            Assert.True(true, "API integration test placeholder");
        }

        // ============================================================
        // E2E TESTS (Filtered out on PRs)
        // ============================================================

        [Fact]
        [Trait("Category", "E2E")]
        public void E2ETest_FullWorkflow_ShouldCompleteSuccessfully()
        {
            // This test runs complete end-to-end scenarios
            // E2E tests are filtered out for all triggers and do not run in CI
            
            Assert.True(true, "E2E test placeholder");
        }

        // ============================================================
        // SKIP TESTS (For tests that need to be temporarily disabled)
        // ============================================================

        [Fact(Skip = "Temporarily disabled - Issue #123")]
        public void Test_CurrentlyBroken_WillFixSoon()
        {
            // This test is skipped and won't run in any environment
            // Use Skip instead of commenting out tests to maintain visibility
            
            Assert.True(false, "This test is disabled");
        }

        // ============================================================
        // COMBINATION (Multiple traits)
        // ============================================================

        [Fact]
        [Trait("Category", "Integration")]
        [Trait("Feature", "Wallet")]
        [Trait("Priority", "High")]
        public void IntegrationTest_WithMultipleTraits_Example()
        {
            // Tests can have multiple traits for more granular filtering
            // Use dotnet test --filter to combine multiple conditions
            // Example: --filter "Category=Integration&Feature=Wallet"
            
            Assert.True(true, "Multi-trait test placeholder");
        }
    }
}
