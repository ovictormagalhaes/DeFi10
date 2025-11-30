using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MyWebWallet.API.Models;

namespace MyWebWallet.API.Services.Interfaces;

/// <summary>
/// Service for managing wallet groups.
/// </summary>
public interface IWalletGroupService
{
    /// <summary>
    /// Creates a new wallet group.
    /// </summary>
    /// <param name="wallets">List of wallet addresses (1-3 addresses)</param>
    /// <param name="displayName">Optional display name for the group</param>
    /// <returns>The created wallet group</returns>
    Task<WalletGroup> CreateAsync(List<string> wallets, string? displayName = null);

    /// <summary>
    /// Updates an existing wallet group.
    /// </summary>
    /// <param name="id">Group ID</param>
    /// <param name="wallets">Updated list of wallet addresses (1-3 addresses)</param>
    /// <param name="displayName">Optional display name</param>
    /// <returns>The updated wallet group, or null if not found</returns>
    Task<WalletGroup?> UpdateAsync(Guid id, List<string> wallets, string? displayName = null);

    /// <summary>
    /// Gets a wallet group by ID.
    /// </summary>
    /// <param name="id">Group ID</param>
    /// <returns>The wallet group, or null if not found</returns>
    Task<WalletGroup?> GetAsync(Guid id);

    /// <summary>
    /// Deletes a wallet group.
    /// </summary>
    /// <param name="id">Group ID</param>
    /// <returns>True if deleted, false if not found</returns>
    Task<bool> DeleteAsync(Guid id);

    /// <summary>
    /// Validates that a list of wallet addresses is valid.
    /// </summary>
    /// <param name="wallets">List of wallet addresses</param>
    /// <returns>Error message if invalid, null if valid</returns>
    string? ValidateWallets(List<string> wallets);
}
