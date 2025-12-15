using Microsoft.AspNetCore.Mvc;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Controllers.Responses;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Domain;

namespace DeFi10.API.Controllers;

[ApiController]
[Route("api/v1/strategies")]
public class StrategyController : ControllerBase
{
    private readonly IStrategyService _strategyService;
    private readonly IWalletGroupService _walletGroupService;

    public StrategyController(
        IStrategyService strategyService,
        IWalletGroupService walletGroupService)
    {
        _strategyService = strategyService;
        _walletGroupService = walletGroupService;
    }

    [HttpPost]
    public async Task<ActionResult<StrategySavedResponse>> Save([FromBody] StrategyRequest request)
    {
        if (request == null) return BadRequest(new { error = "Request body is required" });
        if (request.Items == null || request.Items.Count == 0) return BadRequest(new { error = "Items are required" });

        var walletGroup = await _walletGroupService.GetAsync(request.WalletGroupId);
        if (walletGroup == null)
        {
            return NotFound(new { error = $"Wallet group {request.WalletGroupId} not found" });
        }

        await _strategyService.SaveAsync(request.WalletGroupId, request.Items);
        
        return Ok(new StrategySavedResponse 
        { 
            Key = request.WalletGroupId.ToString(), 
            ItemsCount = request.Items.Count, 
            Accounts = walletGroup.Wallets, 
            SavedAt = DateTime.UtcNow 
        });
    }

    [HttpGet("group/{walletGroupId}")]
    public async Task<ActionResult<object>> GetByGroup(Guid walletGroupId)
    {
        var walletGroup = await _walletGroupService.GetAsync(walletGroupId);
        if (walletGroup == null)
        {
            return NotFound(new { error = $"Wallet group {walletGroupId} not found" });
        }

        var items = await _strategyService.GetAsync(walletGroupId);
        
        return Ok(new 
        { 
            walletGroupId,
            accounts = walletGroup.Wallets,
            items = items ?? new List<StrategyItem>(),
            count = items?.Count ?? 0,
            key = walletGroupId.ToString()
        });
    }
}
