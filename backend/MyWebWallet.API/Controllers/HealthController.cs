using Microsoft.AspNetCore.Mvc;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Health check endpoint for monitoring and deployment services
    /// </summary>
    /// <returns>Health status</returns>
    [HttpGet("health")]
    public ActionResult GetHealth()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            version = "1.0.0",
            environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown",
            application = "Defi10 API"
        });
    }

    /// <summary>
    /// Root endpoint
    /// </summary>
    /// <returns>API information</returns>
    [HttpGet("")]
    public ActionResult GetRoot()
    {
        return Ok(new
        {
            name = "Defi10 API",
            version = "1.0.0",
            description = "Multi-chain DeFi Portfolio Tracker API supporting Base and BNB chains",
            features = new[]
            {
                "Multi-chain wallet analysis",
                "Aave V3 lending/borrowing positions",
                "Uniswap V3 liquidity positions", 
                "Token logo management",
                "Redis caching for performance",
                "Batch token hydration"
            },
            endpoints = new
            {
                health = "/health",
                swagger = "/swagger",
                wallets = "/api/v1/wallets",
                tokens = "/api/v1/tokens",
                cache = "/api/v1/cache"
            },
            supportedChains = new[]
            {
                new { name = "Base", chainId = 8453, protocols = new[] { "Aave V3", "Uniswap V3", "Moralis" } },
                new { name = "BNB", chainId = 56, protocols = new[] { "Moralis" } }
            },
            timestamp = DateTime.UtcNow
        });
    }
}