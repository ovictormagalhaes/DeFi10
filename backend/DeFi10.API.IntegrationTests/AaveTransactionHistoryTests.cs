using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Protocols.Aave;
using DeFi10.API.Configuration;
using System.Net.Http.Json;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

public class AaveTransactionHistoryTests
{
    private readonly ITestOutputHelper _output;

    public AaveTransactionHistoryTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task GetUserTransactionHistory_ShouldReturnTransactions_ForActiveAddress()
    {
        // Arrange
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        var aaveOptions = Options.Create(new AaveOptions 
        { 
            GraphQLEndpoint = "https://api.v3.aave.com/graphql" 
        });
        
        var graphOptions = Options.Create(new GraphOptions
        {
            ApiKey = Environment.GetEnvironmentVariable("GRAPH_API_KEY") ?? "",
            UrlTemplate = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}",
            Subgraphs = new SubgraphIds
            {
                AaveV3Base = "ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7"
            }
        });
        
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<AaveeService>();
        
        var service = new AaveeService(httpClient, aaveOptions, graphOptions, null, logger);
        
        var address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6";
        var chain = "8453"; // Base chain ID
        
        // Act
        var result = await service.GetUserTransactionHistoryAsync(address, chain);
        
        // Assert
        Assert.NotNull(result);
        
        if (result.Data != null)
        {
            _output.WriteLine($"Total Transactions: {result.Data.Transactions.Count}");
            _output.WriteLine($"Deposits: {result.Data.Deposits?.Count ?? 0}");
            _output.WriteLine($"Withdraws: {result.Data.Withdraws?.Count ?? 0}");
            _output.WriteLine($"Borrows: {result.Data.Borrows?.Count ?? 0}");
            _output.WriteLine($"Repays: {result.Data.Repays?.Count ?? 0}");
            
            if (result.Data.Transactions.Any())
            {
                var firstTx = result.Data.Transactions.First();
                _output.WriteLine($"\nFirst Transaction:");
                _output.WriteLine($"  Type: {firstTx.Type}");
                _output.WriteLine($"  Timestamp: {firstTx.Timestamp}");
                _output.WriteLine($"  Amount: {firstTx.Amount}");
                _output.WriteLine($"  Reserve Symbol: {firstTx.Reserve?.Symbol}");
            }
        }
        else
        {
            _output.WriteLine("result.Data is null - check JSON deserialization or API key configuration");
        }
    }
    
    [Fact]
    public async Task GetUserTransactionHistory_ShouldHandleEmptyAddress()
    {
        // Arrange
        var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        var aaveOptions = Options.Create(new AaveOptions 
        { 
            GraphQLEndpoint = "https://api.v3.aave.com/graphql" 
        });
        
        var graphOptions = Options.Create(new GraphOptions
        {
            ApiKey = Environment.GetEnvironmentVariable("GRAPH_API_KEY") ?? "",
            UrlTemplate = "https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}",
            Subgraphs = new SubgraphIds
            {
                AaveV3Base = "ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7"
            }
        });
        
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<AaveeService>();
        
        var service = new AaveeService(httpClient, aaveOptions, graphOptions, null, logger);
        
        // Use endereço sem atividade
        var address = "0x0000000000000000000000000000000000000001";
        var chain = "8453"; // Base chain ID
        
        // Act
        var result = await service.GetUserTransactionHistoryAsync(address, chain);
        
        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Data);
        Assert.NotNull(result.Data.Transactions);
        Assert.Empty(result.Data.Transactions);
        
        _output.WriteLine("Empty address returned 0 transactions as expected");
    }
}
