using Microsoft.AspNetCore.Mvc;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/cache")]
public class CacheController : ControllerBase
{
    private readonly ICacheService _cacheService;

    public CacheController(ICacheService cacheService)
    {
        _cacheService = cacheService;
    }

    /// <summary>
    /// Clears wallet cache for a specific address
    /// </summary>
    /// <param name="address">Wallet address to clear cache for</param>
    /// <param name="chain">Specific chain to clear (optional, if not provided clears all chains)</param>
    /// <returns>Success message</returns>
    [HttpDelete("wallets/{address}")]
    public async Task<ActionResult> ClearWalletCache(string address, [FromQuery] string? chain = null)
    {
        try
        {
            if (!string.IsNullOrEmpty(chain))
            {
                // Clear specific chain cache
                if (Enum.TryParse<Chain>(chain, true, out var parsedChain))
                {
                    var cacheKey = _cacheService.GenerateWalletCacheKey(address, parsedChain);
                    await _cacheService.RemoveAsync(cacheKey);
                    
                    return Ok(new { 
                        message = $"Cache cleared for address {address} on chain {parsedChain}",
                        address,
                        chain = parsedChain.ToString()
                    });
                }
                else
                {
                    return BadRequest(new { error = $"Invalid chain '{chain}'. Supported chains: Base, BNB" });
                }
            }
            else
            {
                // Clear cache for all supported chains and multi-chain combinations
                var supportedChains = new[] { Chain.Base, Chain.BNB };
                var clearedKeys = new List<string>();

                // Clear single chain caches
                foreach (var supportedChain in supportedChains)
                {
                    var cacheKey = _cacheService.GenerateWalletCacheKey(address, supportedChain);
                    await _cacheService.RemoveAsync(cacheKey);
                    clearedKeys.Add(cacheKey);
                }

                // Clear multi-chain cache
                var multiChainKey = _cacheService.GenerateWalletCacheKey(address, supportedChains);
                await _cacheService.RemoveAsync(multiChainKey);
                clearedKeys.Add(multiChainKey);

                return Ok(new { 
                    message = $"Cache cleared for address {address} on all chains",
                    address,
                    clearedKeys = clearedKeys.Count
                });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to clear cache", details = ex.Message });
        }
    }

    /// <summary>
    /// Checks if wallet cache exists for a specific address
    /// </summary>
    /// <param name="address">Wallet address to check</param>
    /// <param name="chain">Specific chain to check (optional)</param>
    /// <returns>Cache status information</returns>
    [HttpGet("wallets/{address}/status")]
    public async Task<ActionResult> GetWalletCacheStatus(string address, [FromQuery] string? chain = null)
    {
        try
        {
            if (!string.IsNullOrEmpty(chain))
            {
                // Check specific chain cache
                if (Enum.TryParse<Chain>(chain, true, out var parsedChain))
                {
                    var cacheKey = _cacheService.GenerateWalletCacheKey(address, parsedChain);
                    var exists = await _cacheService.ExistsAsync(cacheKey);
                    
                    return Ok(new { 
                        address,
                        chain = parsedChain.ToString(),
                        cached = exists,
                        cacheKey
                    });
                }
                else
                {
                    return BadRequest(new { error = $"Invalid chain '{chain}'. Supported chains: Base, BNB" });
                }
            }
            else
            {
                // Check cache for all supported chains
                var supportedChains = new[] { Chain.Base, Chain.BNB };
                var cacheStatus = new List<object>();

                // Check single chain caches
                foreach (var supportedChain in supportedChains)
                {
                    var cacheKey = _cacheService.GenerateWalletCacheKey(address, supportedChain);
                    var exists = await _cacheService.ExistsAsync(cacheKey);
                    
                    cacheStatus.Add(new {
                        chain = supportedChain.ToString(),
                        cached = exists,
                        cacheKey
                    });
                }

                // Check multi-chain cache
                var multiChainKey = _cacheService.GenerateWalletCacheKey(address, supportedChains);
                var multiChainExists = await _cacheService.ExistsAsync(multiChainKey);
                
                cacheStatus.Add(new {
                    chain = "Multi-Chain",
                    cached = multiChainExists,
                    cacheKey = multiChainKey
                });

                return Ok(new { 
                    address,
                    cacheStatus
                });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to check cache status", details = ex.Message });
        }
    }
}