using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace MyWebWallet.API.Models;

/// <summary>
/// Represents a group of wallet addresses (max 3) that can be aggregated together.
/// </summary>
public sealed class WalletGroup
{
    /// <summary>
    /// Unique identifier for this wallet group.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// List of wallet addresses in this group (maximum 3).
    /// Can contain EVM addresses (0x...) or Solana addresses (Base58).
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "At least one wallet address is required")]
    [MaxLength(3, ErrorMessage = "Maximum of 3 wallet addresses allowed")]
    public List<string> Wallets { get; set; } = new();

    /// <summary>
    /// Optional display name for this wallet group.
    /// </summary>
    [MaxLength(100)]
    public string? DisplayName { get; set; }

    /// <summary>
    /// When this wallet group was created.
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// When this wallet group was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
