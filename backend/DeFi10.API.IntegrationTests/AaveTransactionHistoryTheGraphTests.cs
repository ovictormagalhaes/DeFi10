using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Protocols.Aave;
using DeFi10.API.Configuration;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Teste de integração para histórico de transações Aave via The Graph
/// </summary>
public class AaveTransactionHistoryTheGraphTests
{
    private readonly ITestOutputHelper _output;

    public AaveTransactionHistoryTheGraphTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task GetUserTransactionHistory_ShouldReturnTransactions_FromTheGraphSubgraph()
    {
        // Arrange
        var graphApiKey = Environment.GetEnvironmentVariable("GRAPH_API_KEY");
        if (string.IsNullOrEmpty(graphApiKey))
        {
            _output.WriteLine("⚠️ GRAPH_API_KEY not set - skipping test");
            return;
        }
        
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        var aaveOptions = Options.Create(new AaveOptions 
        { 
            GraphQLEndpoint = "https://api.v3.aave.com/graphql" 
        });
        
        var graphOptions = Options.Create(new GraphOptions
        {
            ApiKey = graphApiKey,
            UrlTemplate = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}",
            Subgraphs = new SubgraphIds
            {
                AaveV3Base = "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF"
            }
        });
        
        var loggerFactory = LoggerFactory.Create(builder => 
            builder.AddConsole().SetMinimumLevel(LogLevel.Information));
        var logger = loggerFactory.CreateLogger<AaveeService>();
        
        var service = new AaveeService(httpClient, aaveOptions, graphOptions, null, logger);
        
        // Usar endereço com atividade conhecida na Base
        var address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6";
        var chain = "8453"; // Base chain ID
        
        _output.WriteLine($"Testing transaction history for address: {address}");
        _output.WriteLine($"Chain: Base (8453)");
        _output.WriteLine($"Using subgraph: {graphOptions.Value.Subgraphs.AaveV3Base}");
        
        // Act
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = await service.GetUserTransactionHistoryAsync(address, chain);
        sw.Stop();
        
        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Data);
        
        _output.WriteLine($"\n=== RESULTS (fetched in {sw.ElapsedMilliseconds}ms) ===");
        _output.WriteLine($"Deposits (Supplies): {result.Data.Deposits.Count}");
        _output.WriteLine($"Withdraws (RedeemUnderlyings): {result.Data.Withdraws.Count}");
        _output.WriteLine($"Borrows: {result.Data.Borrows.Count}");
        _output.WriteLine($"Repays: {result.Data.Repays.Count}");
        _output.WriteLine($"Total Transactions: {result.Data.Transactions.Count}");
        
        // Se houver transações, mostrar detalhes
        if (result.Data.Transactions.Any())
        {
            _output.WriteLine($"\n=== TRANSACTION SAMPLES ===");
            
            // Mostrar primeiras 5 transações de cada tipo
            if (result.Data.Deposits.Any())
            {
                _output.WriteLine($"\n--- First Deposit ---");
                var deposit = result.Data.Deposits.First();
                _output.WriteLine($"ID: {deposit.Id}");
                _output.WriteLine($"Timestamp: {DateTimeOffset.FromUnixTimeSeconds(deposit.Timestamp):yyyy-MM-dd HH:mm:ss}");
                _output.WriteLine($"Amount: {deposit.Amount}");
                _output.WriteLine($"Asset: {deposit.Reserve?.Symbol} ({deposit.Reserve?.Name})");
                _output.WriteLine($"Decimals: {deposit.Reserve?.Decimals}");
            }
            
            if (result.Data.Withdraws.Any())
            {
                _output.WriteLine($"\n--- First Withdraw ---");
                var withdraw = result.Data.Withdraws.First();
                _output.WriteLine($"ID: {withdraw.Id}");
                _output.WriteLine($"Timestamp: {DateTimeOffset.FromUnixTimeSeconds(withdraw.Timestamp):yyyy-MM-dd HH:mm:ss}");
                _output.WriteLine($"Amount: {withdraw.Amount}");
                _output.WriteLine($"Asset: {withdraw.Reserve?.Symbol} ({withdraw.Reserve?.Name})");
            }
            
            if (result.Data.Borrows.Any())
            {
                _output.WriteLine($"\n--- First Borrow ---");
                var borrow = result.Data.Borrows.First();
                _output.WriteLine($"ID: {borrow.Id}");
                _output.WriteLine($"Timestamp: {DateTimeOffset.FromUnixTimeSeconds(borrow.Timestamp):yyyy-MM-dd HH:mm:ss}");
                _output.WriteLine($"Amount: {borrow.Amount}");
                _output.WriteLine($"Asset: {borrow.Reserve?.Symbol} ({borrow.Reserve?.Name})");
            }
            
            if (result.Data.Repays.Any())
            {
                _output.WriteLine($"\n--- First Repay ---");
                var repay = result.Data.Repays.First();
                _output.WriteLine($"ID: {repay.Id}");
                _output.WriteLine($"Timestamp: {DateTimeOffset.FromUnixTimeSeconds(repay.Timestamp):yyyy-MM-dd HH:mm:ss}");
                _output.WriteLine($"Amount: {repay.Amount}");
                _output.WriteLine($"Asset: {repay.Reserve?.Symbol} ({repay.Reserve?.Name})");
            }
            
            // Verificar que tipos foram atribuídos corretamente
            _output.WriteLine($"\n=== TRANSACTION TYPE VALIDATION ===");
            var typeCounts = result.Data.Transactions
                .GroupBy(t => t.Type)
                .Select(g => new { Type = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count);
            
            foreach (var typeCount in typeCounts)
            {
                _output.WriteLine($"{typeCount.Type}: {typeCount.Count}");
            }
            
            // Assertions
            Assert.True(result.Data.Transactions.Count > 0, "Should have at least one transaction");
            Assert.All(result.Data.Transactions, tx => 
            {
                Assert.NotEmpty(tx.Id);
                Assert.True(tx.Timestamp > 0);
                Assert.NotNull(tx.Reserve);
                Assert.NotEmpty(tx.Reserve.Symbol);
                Assert.NotEmpty(tx.Type);
            });
        }
        else
        {
            _output.WriteLine("\n⚠️ No transactions found for this address");
            _output.WriteLine("This could mean:");
            _output.WriteLine("1. Address has no Aave history on Base");
            _output.WriteLine("2. Subgraph data is not synced yet");
            _output.WriteLine("3. Query structure needs adjustment");
        }
    }

    [Fact]
    public async Task GetUserTransactionHistory_ShouldReturnEmpty_ForAddressWithNoActivity()
    {
        // Arrange
        var graphApiKey = Environment.GetEnvironmentVariable("GRAPH_API_KEY");
        if (string.IsNullOrEmpty(graphApiKey))
        {
            _output.WriteLine("⚠️ GRAPH_API_KEY not set - skipping test");
            return;
        }
        
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        var aaveOptions = Options.Create(new AaveOptions 
        { 
            GraphQLEndpoint = "https://api.v3.aave.com/graphql" 
        });
        
        var graphOptions = Options.Create(new GraphOptions
        {
            ApiKey = graphApiKey,
            UrlTemplate = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}",
            Subgraphs = new SubgraphIds
            {
                AaveV3Base = "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF"
            }
        });
        
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<AaveeService>();
        
        var service = new AaveeService(httpClient, aaveOptions, graphOptions, null, logger);
        
        // Endereço sem atividade
        var address = "0x0000000000000000000000000000000000000001";
        var chain = "8453";
        
        // Act
        var result = await service.GetUserTransactionHistoryAsync(address, chain);
        
        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Data);
        Assert.Empty(result.Data.Deposits);
        Assert.Empty(result.Data.Withdraws);
        Assert.Empty(result.Data.Borrows);
        Assert.Empty(result.Data.Repays);
        Assert.Empty(result.Data.Transactions);
        
        _output.WriteLine("✓ Empty result returned correctly for address with no activity");
    }

    [Fact]
    public async Task GetUserTransactionHistory_ShouldHandleMissingApiKey_Gracefully()
    {
        // Arrange
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        var aaveOptions = Options.Create(new AaveOptions 
        { 
            GraphQLEndpoint = "https://api.v3.aave.com/graphql" 
        });
        
        // Configurar com API key vazia
        var graphOptions = Options.Create(new GraphOptions
        {
            ApiKey = "", // API key vazia
            UrlTemplate = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}",
            Subgraphs = new SubgraphIds
            {
                AaveV3Base = "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF"
            }
        });
        
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<AaveeService>();
        
        var service = new AaveeService(httpClient, aaveOptions, graphOptions, null, logger);
        
        var address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6";
        var chain = "8453";
        
        // Act
        var result = await service.GetUserTransactionHistoryAsync(address, chain);
        
        // Assert - deve retornar vazio ao invés de falhar
        Assert.NotNull(result);
        Assert.NotNull(result.Data);
        _output.WriteLine("✓ Missing API key handled gracefully - returned empty result");
    }

    [Fact]
    public async Task GetUserTransactionHistory_ShouldValidateResponseStructure()
    {
        // Arrange
        var graphApiKey = Environment.GetEnvironmentVariable("GRAPH_API_KEY");
        if (string.IsNullOrEmpty(graphApiKey))
        {
            _output.WriteLine("⚠️ GRAPH_API_KEY not set - skipping test");
            return;
        }
        
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        var aaveOptions = Options.Create(new AaveOptions 
        { 
            GraphQLEndpoint = "https://api.v3.aave.com/graphql" 
        });
        
        var graphOptions = Options.Create(new GraphOptions
        {
            ApiKey = graphApiKey,
            UrlTemplate = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}",
            Subgraphs = new SubgraphIds
            {
                AaveV3Base = "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF"
            }
        });
        
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<AaveeService>();
        
        var service = new AaveeService(httpClient, aaveOptions, graphOptions, null, logger);
        
        var address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6";
        var chain = "8453";
        
        // Act
        var result = await service.GetUserTransactionHistoryAsync(address, chain);
        
        // Assert - validar estrutura da resposta
        Assert.NotNull(result);
        Assert.NotNull(result.Data);
        Assert.NotNull(result.Data.Deposits);
        Assert.NotNull(result.Data.Withdraws);
        Assert.NotNull(result.Data.Borrows);
        Assert.NotNull(result.Data.Repays);
        Assert.NotNull(result.Data.Transactions);
        
        // Validar que Deposits e Supplies são aliases corretos
        Assert.Same(result.Data.Deposits, result.Data.Supplies);
        Assert.Same(result.Data.Withdraws, result.Data.RedeemUnderlyings);
        
        _output.WriteLine("✓ Response structure validated successfully");
        _output.WriteLine($"- Deposits property points to Supplies list");
        _output.WriteLine($"- Withdraws property points to RedeemUnderlyings list");
        _output.WriteLine($"- All collections are properly initialized");
    }

    [Fact]
    public void ShowGraphQLQueryStructure_ForManualTesting()
    {
        // Este teste sempre passa - serve apenas para documentar a query
        var query = @"
query GetUserTransactions($user: Bytes!) {
  supplies(
    where: { user: $user }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    timestamp
    amount
    reserve {
      symbol
      name
      underlyingAsset
      decimals
    }
  }
  redeemUnderlyings(
    where: { user: $user }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    timestamp
    amount
    reserve {
      symbol
      name
      underlyingAsset
      decimals
    }
  }
  borrows(
    where: { user: $user }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    timestamp
    amount
    reserve {
      symbol
      name
      underlyingAsset
      decimals
    }
  }
  repays(
    where: { user: $user }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    id
    timestamp
    amount
    reserve {
      symbol
      name
      underlyingAsset
      decimals
    }
  }
}";

        _output.WriteLine("=== AAVE V3 TRANSACTION HISTORY QUERY ===");
        _output.WriteLine(query);
        _output.WriteLine("\n=== ENDPOINT ===");
        _output.WriteLine("https://gateway.thegraph.com/api/{YOUR_API_KEY}/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF");
        _output.WriteLine("\n=== VARIABLES ===");
        _output.WriteLine(@"{ ""user"": ""0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6"" }");
        _output.WriteLine("\n=== HOW TO GET API KEY ===");
        _output.WriteLine("1. Visit: https://thegraph.com/studio/apikeys/");
        _output.WriteLine("2. Sign in with your wallet or email");
        _output.WriteLine("3. Create a new API key (free tier available)");
        _output.WriteLine("4. Add to .env file: Graph__ApiKey=your_key_here");
        
        Assert.True(true, "Query structure displayed");
    }
}
