using System.Net.Http.Json;
using System.Text.Json;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Teste para explorar o schema do Aave V3 Base subgraph
/// </summary>
public class AaveSubgraphSchemaTest
{
    private readonly ITestOutputHelper _output;
    private readonly HttpClient _httpClient;
    private readonly string _subgraphUrl;

    public AaveSubgraphSchemaTest(ITestOutputHelper output)
    {
        _output = output;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        
        // Tentar usar API key de variável de ambiente, senão usar endpoint público
        var apiKey = Environment.GetEnvironmentVariable("GRAPH_API_KEY") ?? "";
        var subgraphId = "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF"; // Aave V3 Base
        
        if (!string.IsNullOrEmpty(apiKey))
        {
            _subgraphUrl = $"https://gateway.thegraph.com/api/{apiKey}/subgraphs/id/{subgraphId}";
        }
        else
        {
            // Endpoint público do The Graph (rate limited)
            _subgraphUrl = $"https://gateway.thegraph.com/api/subgraphs/id/{subgraphId}";
        }
        
        _output.WriteLine($"Using subgraph URL: {_subgraphUrl}");
    }

    [Fact]
    public async Task ExploreSchema_ShowAvailableTypes()
    {
        // Query de introspecção para ver os tipos disponíveis no schema
        var introspectionQuery = @"
            query {
              __schema {
                types {
                  name
                  kind
                }
              }
            }";

        var requestBody = new { query = introspectionQuery };
        var response = await _httpClient.PostAsJsonAsync(_subgraphUrl, requestBody);
        var content = await response.Content.ReadAsStringAsync();
        
        _output.WriteLine("=== SCHEMA TYPES ===");
        _output.WriteLine(content);
        
        var json = JsonSerializer.Deserialize<JsonElement>(content);
        if (json.TryGetProperty("data", out var data) && 
            data.TryGetProperty("__schema", out var schema) &&
            schema.TryGetProperty("types", out var types))
        {
            _output.WriteLine("\n=== Tipos relevantes para transações (filtrado) ===");
            foreach (var type in types.EnumerateArray())
            {
                if (type.TryGetProperty("name", out var name))
                {
                    var typeName = name.GetString() ?? "";
                    // Filtrar apenas tipos relevantes
                    if (typeName.Contains("Transaction", StringComparison.OrdinalIgnoreCase) ||
                        typeName.Contains("Supply", StringComparison.OrdinalIgnoreCase) ||
                        typeName.Contains("Borrow", StringComparison.OrdinalIgnoreCase) ||
                        typeName.Contains("Repay", StringComparison.OrdinalIgnoreCase) ||
                        typeName.Contains("Withdraw", StringComparison.OrdinalIgnoreCase) ||
                        typeName.Contains("Deposit", StringComparison.OrdinalIgnoreCase) ||
                        typeName.Contains("User", StringComparison.OrdinalIgnoreCase))
                    {
                        _output.WriteLine($"  - {typeName}");
                    }
                }
            }
        }

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task ExploreSchema_ShowQueryType()
    {
        // Ver quais queries estão disponíveis no root
        var introspectionQuery = @"
            query {
              __schema {
                queryType {
                  fields {
                    name
                    description
                    type {
                      name
                      kind
                    }
                  }
                }
              }
            }";

        var requestBody = new { query = introspectionQuery };
        var response = await _httpClient.PostAsJsonAsync(_subgraphUrl, requestBody);
        var content = await response.Content.ReadAsStringAsync();
        
        _output.WriteLine("=== AVAILABLE QUERIES ===");
        
        var json = JsonSerializer.Deserialize<JsonElement>(content);
        if (json.TryGetProperty("data", out var data) && 
            data.TryGetProperty("__schema", out var schema) &&
            schema.TryGetProperty("queryType", out var queryType) &&
            queryType.TryGetProperty("fields", out var fields))
        {
            foreach (var field in fields.EnumerateArray())
            {
                if (field.TryGetProperty("name", out var name))
                {
                    var fieldName = name.GetString() ?? "";
                    
                    // Filtrar queries relacionadas a transações/histórico
                    if (fieldName.Contains("transaction", StringComparison.OrdinalIgnoreCase) ||
                        fieldName.Contains("supply", StringComparison.OrdinalIgnoreCase) ||
                        fieldName.Contains("borrow", StringComparison.OrdinalIgnoreCase) ||
                        fieldName.Contains("repay", StringComparison.OrdinalIgnoreCase) ||
                        fieldName.Contains("withdraw", StringComparison.OrdinalIgnoreCase) ||
                        fieldName.Contains("user", StringComparison.OrdinalIgnoreCase))
                    {
                        var description = field.TryGetProperty("description", out var desc) 
                            ? desc.GetString() 
                            : "";
                        _output.WriteLine($"\n{fieldName}");
                        if (!string.IsNullOrEmpty(description))
                            _output.WriteLine($"  Description: {description}");
                    }
                }
            }
        }

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task TestSupplyQueryStructure()
    {
        // Tentar query simples para supply
        var testQuery = @"
            query {
              supplies(first: 1) {
                id
              }
            }";

        var requestBody = new { query = testQuery };
        var response = await _httpClient.PostAsJsonAsync(_subgraphUrl, requestBody);
        var content = await response.Content.ReadAsStringAsync();
        
        _output.WriteLine("=== SUPPLY QUERY TEST ===");
        _output.WriteLine(content);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task TestUserTransactionQuery()
    {
        // Tentar query com userTransaction
        var testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb6".ToLowerInvariant();
        
        var testQuery = @"
            query($user: String!) {
              userTransactions(
                first: 10
                where: { user: $user }
                orderBy: timestamp
                orderDirection: desc
              ) {
                id
                timestamp
              }
            }";

        var requestBody = new 
        { 
            query = testQuery,
            variables = new { user = testAddress }
        };
        
        var response = await _httpClient.PostAsJsonAsync(_subgraphUrl, requestBody);
        var content = await response.Content.ReadAsStringAsync();
        
        _output.WriteLine("=== USER TRANSACTION QUERY TEST ===");
        _output.WriteLine(content);

        Assert.True(response.IsSuccessStatusCode);
    }
}
