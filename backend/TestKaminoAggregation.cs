using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace KaminoAggregationTest
{
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.WriteLine("==============================================");
            Console.WriteLine("  KAMINO AGGREGATION TEST");
            Console.WriteLine("==============================================");
            Console.WriteLine();

            // Get wallet address from args or use default
            var walletAddress = args.Length > 0 ? args[0] : "FriCEbw1V99GwrJRXPnSQ6su2TabHabNxiZ3VNsJVe6R";
            
            Console.WriteLine($"Testing wallet: {walletAddress}");
            Console.WriteLine();

            // Check if API is running
            Console.WriteLine("Checking if API is running on http://localhost:10000...");
            using var httpClient = new HttpClient { BaseAddress = new Uri("http://localhost:10000") };
            
            try
            {
                var healthCheck = await httpClient.GetAsync("/health");
                if (!healthCheck.IsSuccessStatusCode)
                {
                    Console.WriteLine("WARNING: API may not be running or health endpoint not available");
                }
            }
            catch
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("ERROR: API is not running!");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Please start the API first:");
                Console.WriteLine("  cd DeFi10.API");
                Console.WriteLine("  dotnet run --environment Development");
                Console.WriteLine();
                return;
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("API is running!");
            Console.ResetColor();
            Console.WriteLine();

            // Call aggregation endpoint
            Console.WriteLine("Calling aggregation endpoint...");
            Console.WriteLine("POST /api/v1/aggregations");
            Console.WriteLine($"Body: {{ \"account\": \"{walletAddress}\", \"chains\": [\"Solana\"] }}");
            Console.WriteLine();

            var payload = new
            {
                account = walletAddress,
                chains = new[] { "Solana" }
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var response = await httpClient.PostAsync("/api/v1/aggregations", content);
                var responseBody = await response.Content.ReadAsStringAsync();

                Console.WriteLine($"Status: {response.StatusCode}");
                Console.WriteLine();

                if (response.IsSuccessStatusCode)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("Response:");
                    Console.ResetColor();

                    // Pretty print JSON
                    var doc = JsonDocument.Parse(responseBody);
                    var prettyJson = JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true });
                    Console.WriteLine(prettyJson);

                    // Extract job ID
                    if (doc.RootElement.TryGetProperty("jobId", out var jobIdElement))
                    {
                        var jobId = jobIdElement.GetString();
                        Console.WriteLine();
                        Console.WriteLine($"Job ID: {jobId}");
                        Console.WriteLine();
                        Console.WriteLine("To check status:");
                        Console.WriteLine($"  GET /api/v1/aggregations/{jobId}/status");
                        Console.WriteLine();
                        Console.WriteLine("To get results:");
                        Console.WriteLine($"  GET /api/v1/aggregations/{jobId}");
                    }
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Error response:");
                    Console.ResetColor();
                    Console.WriteLine(responseBody);
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"Exception: {ex.Message}");
                Console.ResetColor();
            }

            Console.WriteLine();
            Console.WriteLine("==============================================");
            Console.WriteLine("  CHECK API CONSOLE FOR KAMINO LOGS");
            Console.WriteLine("==============================================");
            Console.WriteLine();
            Console.WriteLine("Look for logs starting with:");
            Console.WriteLine("  [Information] KAMINO:");
            Console.WriteLine("  [Debug] KAMINO:");
            Console.WriteLine("  [Warning] KAMINO:");
            Console.WriteLine("  [Error] KAMINO:");
            Console.WriteLine();
        }
    }
}
