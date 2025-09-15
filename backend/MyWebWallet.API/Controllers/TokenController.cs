using Microsoft.AspNetCore.Mvc;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/tokens")]
public class TokenController : ControllerBase
{
    private readonly ITokenLogoService _tokenLogoService;

    public TokenController(ITokenLogoService tokenLogoService)
    {
        _tokenLogoService = tokenLogoService;
    }

    /// <summary>
    /// Gets token logo URL by contract address and chain
    /// </summary>
    /// <param name="address">Token contract address</param>
    /// <param name="chain">Blockchain network</param>
    /// <returns>Token logo URL</returns>
    [HttpGet("{address}/logo")]
    public async Task<ActionResult<object>> GetTokenLogo(string address, [FromQuery] string chain = "Base")
    {
        try
        {
            if (!Enum.TryParse<Chain>(chain, true, out var parsedChain))
            {
                return BadRequest(new { error = $"Invalid chain '{chain}'. Supported chains: Base, BNB" });
            }

            var logoUrl = await _tokenLogoService.GetTokenLogoAsync(address, parsedChain);
            
            if (logoUrl == null)
            {
                return NotFound(new { 
                    message = "Token logo not found",
                    address,
                    chain = parsedChain.ToString()
                });
            }

            return Ok(new { 
                address,
                chain = parsedChain.ToString(),
                logoUrl
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to get token logo", details = ex.Message });
        }
    }

    /// <summary>
    /// Sets or updates token logo URL
    /// </summary>
    /// <param name="address">Token contract address</param>
    /// <param name="request">Logo update request</param>
    /// <returns>Success message</returns>
    [HttpPost("{address}/logo")]
    public async Task<ActionResult> SetTokenLogo(string address, [FromBody] TokenLogoRequest request)
    {
        try
        {
            if (!Enum.TryParse<Chain>(request.Chain, true, out var parsedChain))
            {
                return BadRequest(new { error = $"Invalid chain '{request.Chain}'. Supported chains: Base, BNB" });
            }

            if (string.IsNullOrEmpty(request.LogoUrl))
            {
                return BadRequest(new { error = "Logo URL is required" });
            }

            await _tokenLogoService.SetTokenLogoAsync(address, parsedChain, request.LogoUrl);

            return Ok(new { 
                message = "Token logo updated successfully",
                address,
                chain = parsedChain.ToString(),
                logoUrl = request.LogoUrl
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to set token logo", details = ex.Message });
        }
    }

    /// <summary>
    /// Gets all token logos for a specific chain
    /// </summary>
    /// <param name="chain">Blockchain network</param>
    /// <returns>List of all tokens with their logos</returns>
    [HttpGet("logos")]
    public async Task<ActionResult<object>> GetAllTokenLogos([FromQuery] string chain = "Base")
    {
        try
        {
            if (!Enum.TryParse<Chain>(chain, true, out var parsedChain))
            {
                return BadRequest(new { error = $"Invalid chain '{chain}'. Supported chains: Base, BNB" });
            }

            var tokens = await _tokenLogoService.GetAllTokenLogosAsync(parsedChain);
            var count = await _tokenLogoService.GetCachedTokenCountAsync(parsedChain);

            return Ok(new { 
                chain = parsedChain.ToString(),
                count,
                tokens = tokens.Select(kvp => new {
                    address = kvp.Key,
                    logoUrl = kvp.Value
                })
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to get token logos", details = ex.Message });
        }
    }

    /// <summary>
    /// Gets token logo cache statistics
    /// </summary>
    /// <returns>Cache statistics for all chains</returns>
    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetTokenLogoStats()
    {
        try
        {
            var supportedChains = new[] { Chain.Base, Chain.BNB };
            var stats = new List<object>();

            foreach (var chain in supportedChains)
            {
                var count = await _tokenLogoService.GetCachedTokenCountAsync(chain);
                stats.Add(new {
                    chain = chain.ToString(),
                    chainId = chain.ToNumericChainId(),
                    tokenCount = count
                });
            }

            var totalTokens = stats.Sum(s => (int)s.GetType().GetProperty("tokenCount")!.GetValue(s)!);

            return Ok(new { 
                totalTokens,
                chainStats = stats,
                lastUpdated = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to get token logo stats", details = ex.Message });
        }
    }

    /// <summary>
    /// Reloads all token logos from Redis into memory
    /// </summary>
    /// <returns>Reload status</returns>
    [HttpPost("reload")]
    public async Task<ActionResult> ReloadTokenLogos()
    {
        try
        {
            await _tokenLogoService.LoadAllTokensIntoMemoryAsync();
            
            var baseCount = await _tokenLogoService.GetCachedTokenCountAsync(Chain.Base);
            var bnbCount = await _tokenLogoService.GetCachedTokenCountAsync(Chain.BNB);
            
            return Ok(new { 
                message = "Token logos reloaded successfully",
                loaded = new {
                    baseTokens = baseCount,
                    bnbTokens = bnbCount,
                    total = baseCount + bnbCount
                },
                reloadedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to reload token logos", details = ex.Message });
        }
    }
}

public class TokenLogoRequest
{
    public string Chain { get; set; } = "Base";
    public string LogoUrl { get; set; } = string.Empty;
}