using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/wallet-groups")]
public class WalletGroupsController : ControllerBase
{
    private readonly IWalletGroupService _walletGroupService;
    private readonly ILogger<WalletGroupsController> _logger;

    public WalletGroupsController(
        IWalletGroupService walletGroupService,
        ILogger<WalletGroupsController> logger)
    {
        _walletGroupService = walletGroupService;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new wallet group.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWalletGroupRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Request body is required" });
        }

        var validationError = _walletGroupService.ValidateWallets(request.Wallets);
        if (validationError != null)
        {
            return BadRequest(new { error = validationError });
        }

        try
        {
            var group = await _walletGroupService.CreateAsync(request.Wallets, request.DisplayName);
            
            _logger.LogInformation("Created wallet group {GroupId}", group.Id);
            
            return CreatedAtAction(
                nameof(Get),
                new { id = group.Id },
                new
                {
                    id = group.Id,
                    wallets = group.Wallets,
                    displayName = group.DisplayName,
                    createdAt = group.CreatedAt,
                    updatedAt = group.UpdatedAt
                });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create wallet group");
            return StatusCode(500, new { error = "Failed to create wallet group" });
        }
    }

    /// <summary>
    /// Gets a wallet group by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        try
        {
            var group = await _walletGroupService.GetAsync(id);
            
            if (group == null)
            {
                return NotFound(new { error = "Wallet group not found" });
            }

            return Ok(new
            {
                id = group.Id,
                wallets = group.Wallets,
                displayName = group.DisplayName,
                createdAt = group.CreatedAt,
                updatedAt = group.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to retrieve wallet group" });
        }
    }

    /// <summary>
    /// Updates an existing wallet group.
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWalletGroupRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { error = "Request body is required" });
        }

        var validationError = _walletGroupService.ValidateWallets(request.Wallets);
        if (validationError != null)
        {
            return BadRequest(new { error = validationError });
        }

        try
        {
            var group = await _walletGroupService.UpdateAsync(id, request.Wallets, request.DisplayName);
            
            if (group == null)
            {
                return NotFound(new { error = "Wallet group not found" });
            }

            _logger.LogInformation("Updated wallet group {GroupId}", id);

            return Ok(new
            {
                id = group.Id,
                wallets = group.Wallets,
                displayName = group.DisplayName,
                createdAt = group.CreatedAt,
                updatedAt = group.UpdatedAt
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to update wallet group" });
        }
    }

    /// <summary>
    /// Deletes a wallet group.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var deleted = await _walletGroupService.DeleteAsync(id);
            
            if (!deleted)
            {
                return NotFound(new { error = "Wallet group not found" });
            }

            _logger.LogInformation("Deleted wallet group {GroupId}", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete wallet group {GroupId}", id);
            return StatusCode(500, new { error = "Failed to delete wallet group" });
        }
    }

    // DTOs
    public sealed class CreateWalletGroupRequest
    {
        [Required]
        [MinLength(1, ErrorMessage = "At least one wallet address is required")]
        [MaxLength(3, ErrorMessage = "Maximum of 3 wallet addresses allowed")]
        public List<string> Wallets { get; set; } = new();

        [MaxLength(100)]
        public string? DisplayName { get; set; }
    }

    public sealed class UpdateWalletGroupRequest
    {
        [Required]
        [MinLength(1, ErrorMessage = "At least one wallet address is required")]
        [MaxLength(3, ErrorMessage = "Maximum of 3 wallet addresses allowed")]
        public List<string> Wallets { get; set; } = new();

        [MaxLength(100)]
        public string? DisplayName { get; set; }
    }
}
