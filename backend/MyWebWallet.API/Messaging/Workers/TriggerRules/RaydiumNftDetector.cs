using MyWebWallet.API.Messaging.Contracts.Enums;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using System.Text.Json;

namespace MyWebWallet.API.Messaging.Workers.TriggerRules;

/// <summary>
/// Detects Raydium CLMM position NFTs (SPL tokens with amount=1, decimals=0) and triggers Raydium protocol queries
/// </summary>
public class RaydiumNftDetector : IProtocolTriggerDetector
{
    private readonly ILogger<RaydiumNftDetector> _logger;
    private readonly IProtocolConfigurationService _protocolConfig;

    public RaydiumNftDetector(ILogger<RaydiumNftDetector> logger, IProtocolConfigurationService protocolConfig)
    {
        _logger = logger;
        _protocolConfig = protocolConfig;
    }

    public IntegrationProvider HandlesProvider => IntegrationProvider.SolanaNfts;

    public List<(IntegrationProvider Provider, Chain Chain)> DetectTriggersFromPayload(object? payload, Chain chain)
    {
        var triggers = new List<(IntegrationProvider, Chain)>();

        if (chain != Chain.Solana)
        {
            _logger.LogDebug("RaydiumNftDetector: Skipping non-Solana chain {Chain}", chain);
            return triggers;
        }

        if (payload == null)
        {
            _logger.LogDebug("RaydiumNftDetector: Null payload received for Solana");
            return triggers;
        }

        try
        {
            // Payload is SolanaNFTResponse with Nfts property containing NFT array
            var jsonElement = JsonSerializer.SerializeToElement(payload);
            
            // Try to extract the "nfts" array from SolanaNFTResponse
            JsonElement nftArray;
            if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("nfts", out var nftsProp))
            {
                nftArray = nftsProp;
            }
            else if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("Nfts", out var nftsPropUpper))
            {
                nftArray = nftsPropUpper;
            }
            else if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                nftArray = jsonElement; // Already an array
            }
            else
            {
                _logger.LogWarning("RaydiumNftDetector: Could not extract NFT array from Solana payload");
                return triggers;
            }

            var tokenCount = nftArray.GetArrayLength();
            _logger.LogDebug("RaydiumNftDetector: Scanning {Count} Solana tokens for NFTs", tokenCount);

            // Raydium CLMM positions are NFTs with amount=1 and decimals=0
            foreach (var token in nftArray.EnumerateArray())
            {
                var hasAmount = token.TryGetProperty("amount", out var amountProp);
                var hasDecimals = token.TryGetProperty("decimals", out var decimalsProp);

                if (hasAmount && hasDecimals)
                {
                    // Check if amount = 1 and decimals = 0 (NFT characteristics)
                    var amount = amountProp.ValueKind == JsonValueKind.String 
                        ? (amountProp.GetString() == "1" ? 1 : 0)
                        : (amountProp.ValueKind == JsonValueKind.Number ? amountProp.GetInt32() : 0);
                    
                    var decimals = decimalsProp.ValueKind == JsonValueKind.String
                        ? (decimalsProp.GetString() == "0" ? 0 : -1)
                        : (decimalsProp.ValueKind == JsonValueKind.Number ? decimalsProp.GetInt32() : -1);

                    if (amount == 1 && decimals == 0)
                    {
                        // Check if Raydium is enabled on Solana before triggering
                        if (!_protocolConfig.IsProtocolEnabledOnChain("raydium", Chain.Solana))
                        {
                            _logger.LogDebug(
                                "RaydiumNftDetector: Raydium CLMM NFT found but protocol is disabled on Solana - skipping trigger");
                            break;
                        }
                        
                        _logger.LogInformation(
                            "RaydiumNftDetector: TRIGGER DETECTED - Raydium CLMM position NFT found (amount=1, decimals=0)");
                        
                        triggers.Add((IntegrationProvider.SolanaRaydiumPositions, Chain.Solana));
                        break; // Only need to trigger once
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "RaydiumNftDetector: Error processing Solana token payload");
        }

        if (triggers.Count > 0)
        {
            _logger.LogInformation("RaydiumNftDetector: Returning {Count} triggers for Solana", triggers.Count);
        }

        return triggers;
    }
}
