using Microsoft.AspNetCore.Mvc;
using DeFi10.API.Models;
using DeFi10.API.Services.Core;

namespace DeFi10.API.Controllers;

[ApiController]
[Route("api/v1/tokens")]
public class TokensController : ControllerBase
{
    private readonly ITokenLogoService _tokenLogoService;
    private readonly ILogger<TokensController> _logger;

    public TokensController(ITokenLogoService tokenLogoService, ILogger<TokensController> logger)
    {
        _tokenLogoService = tokenLogoService;
        _logger = logger;
    }

    /// <summary>
    /// Get token logo URL by address and chain
    /// </summary>
    /// <param name="address">Token contract address</param>
    /// <param name="chain">Blockchain name (Base, Ethereum, Solana, etc.)</param>
    /// <returns>Logo URL if found, 404 otherwise</returns>
    [HttpGet("{address}/logo")]
    public async Task<ActionResult<string>> GetTokenLogo([FromRoute] string address, [FromQuery] string chain = "Base")
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return BadRequest(new { error = "Token address is required" });
        }

        if (!Enum.TryParse<Chain>(chain, true, out var chainEnum))
        {
            return BadRequest(new { error = $"Invalid chain: {chain}" });
        }

        try
        {
            var logoUrl = await _tokenLogoService.GetTokenLogoAsync(address, chainEnum);

            if (string.IsNullOrEmpty(logoUrl))
            {
                _logger.LogDebug("Logo not found for token {Address} on {Chain}", address, chain);
                return NotFound(new { error = "Logo not found for this token" });
            }

            return Ok(new { logoUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching logo for token {Address} on {Chain}", address, chain);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Get count of cached token logos
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetTokenStats([FromQuery] string chain = "Base")
    {
        if (!Enum.TryParse<Chain>(chain, true, out var chainEnum))
        {
            return BadRequest(new { error = $"Invalid chain: {chain}" });
        }

        try
        {
            var count = await _tokenLogoService.GetCachedTokenCountAsync(chainEnum);
            return Ok(new { cachedTokenCount = count, chain = chain });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching token stats for {Chain}", chain);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}
