using Microsoft.AspNetCore.Mvc;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/wallets")]
public class WalletController : ControllerBase
{
    private readonly IWalletService _walletService;

    public WalletController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    /// <summary>
    /// Gets information from a Web3 wallet including tokens, balances and values in USD
    /// </summary>
    /// <param name="account">Wallet address (Ethereum or Solana)</param>
    /// <param name="chain">Single blockchain network (optional, defaults to Base)</param>
    /// <param name="chains">Multiple blockchain networks separated by comma (optional, overrides chain parameter)</param>
    /// <returns>Complete wallet information</returns>
    [HttpGet("accounts/{account}")]
    public async Task<ActionResult<WalletResponse>> GetAccount(
        string account, 
        [FromQuery] string? chain = null,
        [FromQuery] string? chains = null)
    {
        try
        {
            WalletResponse result;

            // Priority: chains parameter > chain parameter > default
            chains = "Base,BNB";
            if (!string.IsNullOrEmpty(chains))
            {
                // Parse multiple chains
                var chainNames = chains.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                      .Select(c => c.Trim())
                                      .ToList();

                if (!chainNames.Any())
                    return BadRequest(new { error = "Empty chains parameter provided" });

                var parsedChains = new List<Chain>();
                var invalidChains = new List<string>();

                foreach (var chainName in chainNames)
                {
                    if (Enum.TryParse<Chain>(chainName, true, out var parsedChain))
                        parsedChains.Add(parsedChain);
                    else
                        invalidChains.Add(chainName);
                }

                if (invalidChains.Any())
                {
                    return BadRequest(new
                    {
                        error = $"Invalid chains: {string.Join(", ", invalidChains)}. Supported chains: Base, BNB"
                    });
                }

                Console.WriteLine($"WalletController: Processing multiple chains: {string.Join(", ", parsedChains)}");
                result = await _walletService.GetWalletInfoAsync(account, parsedChains);
            }
            else if (!string.IsNullOrEmpty(chain))
            {
                // Parse single chain
                if (Enum.TryParse<Chain>(chain, true, out var parsedChain))
                {
                    Console.WriteLine($"WalletController: Processing single chain: {parsedChain}");
                    result = await _walletService.GetWalletInfoAsync(account, parsedChain);
                }
                else
                {
                    return BadRequest(new { error = $"Invalid chain '{chain}'. Supported chains: Base, BNB" });
                }
            }
            else
            {
                // Use default chain (Base)
                Console.WriteLine("WalletController: Using default chain (Base)");
                result = await _walletService.GetWalletInfoAsync(account);
            }

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (NotSupportedException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Internal server error", details = ex.Message });
        }
    }

    /// <summary>
    /// Gets supported chains for wallet operations
    /// </summary>
    /// <returns>List of supported blockchain networks with metadata</returns>
    [HttpGet("supported-chains")]
    public ActionResult<SupportedChainsResponse> GetSupportedChains()
    {
        var supportedChains = new List<SupportedChainResponse>
        {
            new()
            {
                Name = "Base",
                Id = Chain.Base.ToChainId(),
                ChainId = Chain.Base.ToNumericChainId(),
                DisplayName = Chain.Base.GetDisplayName(),
                IconUrl = Chain.Base.GetIconUrl()
            },
            new()
            {
                Name = "BNB",
                Id = Chain.BNB.ToChainId(),
                ChainId = Chain.BNB.ToNumericChainId(),
                DisplayName = Chain.BNB.GetDisplayName(),
                IconUrl = Chain.BNB.GetIconUrl()
            }
        };

        var response = new SupportedChainsResponse
        {
            Chains = supportedChains
        };

        return Ok(response);
    }
}