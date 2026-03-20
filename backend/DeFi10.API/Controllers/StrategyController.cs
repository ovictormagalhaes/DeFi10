using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Controllers.Responses;
using DeFi10.API.Services.Domain;
using DeFi10.API.Models;

namespace DeFi10.API.Controllers;

[ApiController]
[Route("api/v1/strategies")]
[Authorize]
public class StrategyController : ControllerBase
{
    private readonly IStrategyService _strategyService;
    private readonly IWalletGroupService _walletGroupService;
    private readonly ILogger<StrategyController> _logger;

    public StrategyController(
        IStrategyService strategyService,
        IWalletGroupService walletGroupService,
        ILogger<StrategyController> logger)
    {
        _strategyService = strategyService;
        _walletGroupService = walletGroupService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<StrategiesSavedResponse>> Save([FromBody] StrategiesRequest request)
    {
        if (request == null) return BadRequest(new { error = "Request body is required" });
        if (request.Strategies == null) request.Strategies = new List<StrategyRequest>();

        // Validate wallet group ownership
        var walletGroupIdFromToken = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                                   ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(walletGroupIdFromToken) || !Guid.TryParse(walletGroupIdFromToken, out var tokenWalletGroupId))
        {
            return Unauthorized(new { error = "Invalid or missing authentication token" });
        }

        if (tokenWalletGroupId != request.WalletGroupId)
        {
            _logger.LogWarning("Wallet group ID mismatch: token={TokenId}, requested={RequestedId}", 
                tokenWalletGroupId, request.WalletGroupId);
            return Forbid();
        }

        var walletGroup = await _walletGroupService.GetAsync(request.WalletGroupId);
        if (walletGroup == null)
        {
            return NotFound(new { error = $"Wallet group {request.WalletGroupId} not found" });
        }

        var result = await _strategyService.SaveStrategiesAsync(request.WalletGroupId, walletGroup.Wallets.ToList(), request.Strategies);
        
        return Ok(new StrategiesSavedResponse 
        { 
            Key = result.Key, 
            StrategiesCount = result.Count,
            Strategies = result.Strategies.Select(s => new StrategySummary
            {
                Id = s.Id,
                StrategyType = (int)s.StrategyType,
                Name = s.Name,
                AllocationsCount = s.Allocations?.Count ?? 0,
                TargetsCount = s.Targets?.Count ?? 0
            }).ToList(),
            Accounts = result.Accounts, 
            SavedAt = DateTime.UtcNow 
        });
    }

    [HttpGet("{walletGroupId}")]
    public async Task<ActionResult<object>> GetByGroup(Guid walletGroupId)
    {
        // Validate wallet group ownership
        var walletGroupIdFromToken = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                                   ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(walletGroupIdFromToken) || !Guid.TryParse(walletGroupIdFromToken, out var tokenWalletGroupId))
        {
            return Unauthorized(new { error = "Invalid or missing authentication token" });
        }

        if (tokenWalletGroupId != walletGroupId)
        {
            _logger.LogWarning("Wallet group ID mismatch: token={TokenId}, requested={RequestedId}", 
                tokenWalletGroupId, walletGroupId);
            return Forbid();
        }

        var walletGroup = await _walletGroupService.GetAsync(walletGroupId);
        if (walletGroup == null)
        {
            return NotFound(new { error = $"Wallet group {walletGroupId} not found" });
        }

        var result = await _strategyService.GetStrategiesAsync(walletGroupId);
        
        if (result == null)
        {
            return Ok(new 
            { 
                walletGroupId,
                accounts = walletGroup.Wallets,
                strategies = new List<object>(),
                count = 0,
                key = walletGroupId.ToString()
            });
        }

        return Ok(result);
    }
}
