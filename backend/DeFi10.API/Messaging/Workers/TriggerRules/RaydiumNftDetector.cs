using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using System.Text.Json;

namespace DeFi10.API.Messaging.Workers.TriggerRules;

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

        _logger.LogDebug("RaydiumNftDetector: Starting detection for chain {Chain}", chain);

        if (chain != Chain.Solana)
        {
            _logger.LogDebug("RaydiumNftDetector: Skipping non-Solana chain {Chain}", chain);
            return triggers;
        }

        if (payload == null)
        {
            _logger.LogWarning("RaydiumNftDetector: Null payload received for Solana");
            return triggers;
        }

        try
        {
            var jsonElement = JsonSerializer.SerializeToElement(payload);
            
            JsonElement nftArray;
            if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("nfts", out var nftsProp))
            {
                nftArray = nftsProp;
                _logger.LogDebug("RaydiumNftDetector: Extracted 'nfts' property from payload");
            }
            else if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("Nfts", out var nftsPropUpper))
            {
                nftArray = nftsPropUpper;
                _logger.LogDebug("RaydiumNftDetector: Extracted 'Nfts' property from payload");
            }
            else if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                nftArray = jsonElement; // Already an array
                _logger.LogDebug("RaydiumNftDetector: Payload is already an array");
            }
            else
            {
                _logger.LogWarning("RaydiumNftDetector: Could not extract NFT array from Solana payload. PayloadKind={Kind}", 
                    jsonElement.ValueKind);
                return triggers;
            }

            var tokenCount = nftArray.GetArrayLength();
            _logger.LogDebug("RaydiumNftDetector: Scanning {Count} Solana tokens for NFTs", tokenCount);

            // Raydium CLMM positions are NFTs with amount=1 and decimals=0
            var nftCandidatesFound = 0;
            var tokenIndex = 0;
            
            foreach (var token in nftArray.EnumerateArray())
            {
                tokenIndex++;
                
                var hasAmount = token.TryGetProperty("amount", out var amountProp);
                var hasDecimals = token.TryGetProperty("decimals", out var decimalsProp);

                if (!hasAmount || !hasDecimals)
                {
                    _logger.LogDebug("RaydiumNftDetector: Token #{Index} - Missing amount or decimals property (hasAmount={HasAmount}, hasDecimals={HasDecimals})",
                        tokenIndex, hasAmount, hasDecimals);
                    continue;
                }

                // Check if amount = 1 and decimals = 0 (NFT characteristics)
                var amount = amountProp.ValueKind == JsonValueKind.String 
                    ? (amountProp.GetString() == "1" ? 1 : 0)
                    : (amountProp.ValueKind == JsonValueKind.Number ? amountProp.GetInt32() : 0);
                
                var decimals = decimalsProp.ValueKind == JsonValueKind.String
                    ? (decimalsProp.GetString() == "0" ? 0 : -1)
                    : (decimalsProp.ValueKind == JsonValueKind.Number ? decimalsProp.GetInt32() : -1);

                _logger.LogDebug("RaydiumNftDetector: Token #{Index} - amount={Amount}, decimals={Decimals}",
                    tokenIndex, amount, decimals);

                if (amount == 1 && decimals == 0)
                {
                    nftCandidatesFound++;
                    
                    // Try to get mint address for logging
                    var mint = token.TryGetProperty("mint", out var mintProp) ? mintProp.GetString() : "unknown";
                    
                    _logger.LogDebug("RaydiumNftDetector: NFT candidate #{CandidateIndex} found at token #{TokenIndex} - mint={Mint}, amount=1, decimals=0",
                        nftCandidatesFound, tokenIndex, mint);
                    
                    // Check if Raydium is enabled on Solana before triggering
                    if (!_protocolConfig.IsProtocolEnabledOnChain("raydium", Chain.Solana))
                    {
                        _logger.LogWarning(
                            "RaydiumNftDetector: Raydium CLMM NFT found but protocol is disabled on Solana - skipping trigger");
                        break;
                    }
                    
                    _logger.LogInformation(
                        "RaydiumNftDetector: TRIGGER DETECTED - Raydium CLMM position NFT found (amount=1, decimals=0, mint={Mint})",
                        mint);
                    
                    triggers.Add((IntegrationProvider.SolanaRaydiumPositions, Chain.Solana));
                    break; // Only need to trigger once
                }
            }
            
            if (nftCandidatesFound == 0)
            {
                _logger.LogDebug("RaydiumNftDetector: No NFT candidates (amount=1, decimals=0) found after scanning {Count} tokens",
                    tokenCount);
            }
            else if (triggers.Count == 0)
            {
                _logger.LogDebug("RaydiumNftDetector: Found {Count} NFT candidates but no triggers generated (protocol may be disabled)",
                    nftCandidatesFound);
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
        else
        {
            _logger.LogDebug("RaydiumNftDetector: No triggers detected for Solana");
        }

        return triggers;
    }
}
