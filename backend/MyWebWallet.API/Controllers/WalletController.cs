using Microsoft.AspNetCore.Mvc;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/wallets")]
public class WalletController : ControllerBase
{
    private readonly IChainConfigurationService _chainConfig;

    public WalletController(IChainConfigurationService chainConfigurationService)
    {
        _chainConfig = chainConfigurationService;
    }

    /// <summary>
    /// Gets supported chains for wallet operations (driven by configuration)
    /// </summary>
    [HttpGet("supported-chains")]
    public ActionResult<SupportedChainsResponse> GetSupportedChains()
    {
        var chains = _chainConfig.GetEnabledChains()
            .Select(chainEnum => new { chainEnum, cfg = _chainConfig.GetChainConfig(chainEnum) })
            .Where(x => x.cfg != null)
            .Select(x => new SupportedChainResponse
            {
                Name = x.chainEnum.ToString(),
                Id = x.cfg!.Slug ?? x.chainEnum.ToString().ToLowerInvariant(),
                ChainId = x.cfg!.ChainId,
                DisplayName = string.IsNullOrWhiteSpace(x.cfg.DisplayName) ? x.chainEnum.ToString() : x.cfg.DisplayName,
                IconUrl = string.IsNullOrWhiteSpace(x.cfg.IconUrl) ? string.Empty : x.cfg.IconUrl
            })
            .OrderBy(c => c.ChainId)
            .ToList();

        var response = new SupportedChainsResponse
        {
            Chains = chains,
            LastUpdated = DateTime.UtcNow
        };

        return Ok(response);
    }
}