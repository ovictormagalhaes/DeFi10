using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using DeFi10.API.Infrastructure;
using DeFi10.API.Models;
using DeFi10.API.Repositories;
using DeFi10.API.Services.Interfaces;

namespace DeFi10.API.Services.Domain;
public sealed class WalletGroupService : IWalletGroupService
{
    private readonly IWalletGroupRepository _repository;
    private readonly ISystemClock _clock;
    private readonly ILogger<WalletGroupService> _logger;

    private static readonly Regex EthAddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);
    private static readonly Regex SolAddressRegex = new("^[1-9A-HJ-NP-Za-km-z]{32,44}$", RegexOptions.Compiled);

    private const int MaxWallets = 3;
    private const int MinWallets = 1;

    public WalletGroupService(
        IWalletGroupRepository repository,
        ISystemClock clock,
        ILogger<WalletGroupService> logger)
    {
        _repository = repository;
        _clock = clock;
        _logger = logger;
    }

    public async Task<WalletGroup> CreateAsync(List<string> wallets, string? displayName = null, string? password = null)
    {
        var validationError = ValidateWallets(wallets);
        if (validationError != null)
        {
            throw new ArgumentException(validationError);
        }

        var group = new WalletGroup
        {
            Id = Guid.NewGuid(),
            Wallets = wallets.Select(w => w.Trim()).ToList(),
            DisplayName = displayName?.Trim(),
            PasswordHash = password != null ? BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12) : null,
            CreatedAt = _clock.UtcNow,
            UpdatedAt = _clock.UtcNow,
            IsDeleted = false
        };

        await _repository.CreateAsync(group);
        
        _logger.LogInformation("Created wallet group {GroupId} with {Count} wallets, hasPassword={HasPassword}", 
            group.Id, group.Wallets.Count, password != null);
        
        return group;
    }

    public async Task<WalletGroup?> UpdateAsync(Guid id, List<string> wallets, string? displayName = null)
    {
        var validationError = ValidateWallets(wallets);
        if (validationError != null)
        {
            throw new ArgumentException(validationError);
        }

        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
        {
            return null;
        }

        existing.Wallets = wallets.Select(w => w.Trim()).ToList();
        existing.DisplayName = displayName?.Trim();
        existing.UpdatedAt = _clock.UtcNow;

        await _repository.UpdateAsync(existing);
        
        _logger.LogInformation("Updated wallet group {GroupId} with {Count} wallets", id, existing.Wallets.Count);
        
        return existing;
    }

    public async Task<WalletGroup?> GetAsync(Guid id)
    {
        try
        {
            return await _repository.GetByIdAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get wallet group {GroupId}", id);
            return null;
        }
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var deleted = await _repository.DeleteAsync(id);
        
        if (deleted)
        {
            _logger.LogInformation("Deleted wallet group {GroupId}", id);
        }
        
        return deleted;
    }

    public string? ValidateWallets(List<string> wallets)
    {
        if (wallets == null || wallets.Count < MinWallets)
        {
            return $"At least {MinWallets} wallet address is required";
        }

        if (wallets.Count > MaxWallets)
        {
            return $"Maximum of {MaxWallets} wallet addresses allowed";
        }

        var trimmed = wallets.Select(w => w?.Trim()).ToList();

        if (trimmed.Any(string.IsNullOrWhiteSpace))
        {
            return "All wallet addresses must be non-empty";
        }

        var evmAddresses = trimmed.Where(w => EthAddressRegex.IsMatch(w!)).Select(w => w!.ToLowerInvariant()).ToList();
        var solAddresses = trimmed.Where(w => SolAddressRegex.IsMatch(w!)).ToList();
        
        if (evmAddresses.Count != evmAddresses.Distinct().Count())
        {
            return "Duplicate EVM addresses detected (case-insensitive)";
        }

        if (solAddresses.Count != solAddresses.Distinct().Count())
        {
            return "Duplicate Solana addresses detected";
        }

        for (int i = 0; i < trimmed.Count; i++)
        {
            var wallet = trimmed[i]!;
            
            if (!EthAddressRegex.IsMatch(wallet) && !SolAddressRegex.IsMatch(wallet))
            {
                return $"Wallet address at index {i} is invalid. Must be a valid Ethereum (0x...) or Solana (Base58) address.";
            }
        }

        return null;
    }

    public async Task<bool> ValidatePasswordAsync(Guid id, string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return false;

        var group = await GetAsync(id);
        if (group == null || string.IsNullOrWhiteSpace(group.PasswordHash))
            return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, group.PasswordHash);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify password for wallet group {GroupId}", id);
            return false;
        }
    }
}
