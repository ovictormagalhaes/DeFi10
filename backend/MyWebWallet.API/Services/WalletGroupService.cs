using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using MyWebWallet.API.Infrastructure;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using StackExchange.Redis;

namespace MyWebWallet.API.Services;

/// <summary>
/// Redis-based implementation of wallet group management.
/// </summary>
public sealed class WalletGroupService : IWalletGroupService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ISystemClock _clock;
    private readonly ILogger<WalletGroupService> _logger;

    private static readonly Regex EthAddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);
    private static readonly Regex SolAddressRegex = new("^[1-9A-HJ-NP-Za-km-z]{32,44}$", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private const string KeyPrefix = "walletgroup:";
    private const int MaxWallets = 3;
    private const int MinWallets = 1;

    public WalletGroupService(
        IConnectionMultiplexer redis,
        ISystemClock clock,
        ILogger<WalletGroupService> logger)
    {
        _redis = redis;
        _clock = clock;
        _logger = logger;
    }

    public async Task<WalletGroup> CreateAsync(List<string> wallets, string? displayName = null)
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
            CreatedAt = _clock.UtcNow,
            UpdatedAt = _clock.UtcNow
        };

        var db = _redis.GetDatabase();
        var key = GetKey(group.Id);
        var json = JsonSerializer.Serialize(group, JsonOptions);
        
        await db.StringSetAsync(key, json);
        
        _logger.LogInformation("Created wallet group {GroupId} with {Count} wallets", group.Id, group.Wallets.Count);
        
        return group;
    }

    public async Task<WalletGroup?> UpdateAsync(Guid id, List<string> wallets, string? displayName = null)
    {
        var validationError = ValidateWallets(wallets);
        if (validationError != null)
        {
            throw new ArgumentException(validationError);
        }

        var existing = await GetAsync(id);
        if (existing == null)
        {
            return null;
        }

        existing.Wallets = wallets.Select(w => w.Trim()).ToList();
        existing.DisplayName = displayName?.Trim();
        existing.UpdatedAt = _clock.UtcNow;

        var db = _redis.GetDatabase();
        var key = GetKey(id);
        var json = JsonSerializer.Serialize(existing, JsonOptions);
        
        await db.StringSetAsync(key, json);
        
        _logger.LogInformation("Updated wallet group {GroupId} with {Count} wallets", id, existing.Wallets.Count);
        
        return existing;
    }

    public async Task<WalletGroup?> GetAsync(Guid id)
    {
        var db = _redis.GetDatabase();
        var key = GetKey(id);
        var json = await db.StringGetAsync(key);

        if (!json.HasValue)
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<WalletGroup>(json!, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deserialize wallet group {GroupId}", id);
            return null;
        }
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var db = _redis.GetDatabase();
        var key = GetKey(id);
        var deleted = await db.KeyDeleteAsync(key);
        
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

        // Trim and validate each address
        var trimmed = wallets.Select(w => w?.Trim()).ToList();

        // Check for null or empty
        if (trimmed.Any(string.IsNullOrWhiteSpace))
        {
            return "All wallet addresses must be non-empty";
        }

        // Check for duplicates (case-insensitive for EVM, case-sensitive for Solana)
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

        // Validate each address format
        for (int i = 0; i < trimmed.Count; i++)
        {
            var wallet = trimmed[i]!;
            
            if (!EthAddressRegex.IsMatch(wallet) && !SolAddressRegex.IsMatch(wallet))
            {
                return $"Wallet address at index {i} is invalid. Must be a valid Ethereum (0x...) or Solana (Base58) address.";
            }
        }

        return null; // Valid
    }

    private static string GetKey(Guid id) => $"{KeyPrefix}{id}";
}
