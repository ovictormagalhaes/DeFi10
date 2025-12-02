using MyWebWallet.API.Messaging.Contracts.Enums;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using System.Text.Json;

namespace MyWebWallet.API.Messaging.Workers.TriggerRules;

/// <summary>
/// Detects Uniswap V3 position NFTs and triggers protocol queries for relevant chains
/// </summary>
public class UniswapV3NftDetector : IProtocolTriggerDetector
{
    private readonly ILogger<UniswapV3NftDetector> _logger;
    private readonly IProtocolConfigurationService _protocolConfig;

    // Uniswap V3 NonfungiblePositionManager contracts
    private static readonly Dictionary<Chain, string> UniswapV3NftContracts = new()
    {
        { Chain.Base, "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1" },
        { Chain.Arbitrum, "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" },
        { Chain.Ethereum, "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" },
    };

    public UniswapV3NftDetector(ILogger<UniswapV3NftDetector> logger, IProtocolConfigurationService protocolConfig)
    {
        _logger = logger;
        _protocolConfig = protocolConfig;
    }

    public IntegrationProvider HandlesProvider => IntegrationProvider.MoralisNfts;

    public List<(IntegrationProvider Provider, Chain Chain)> DetectTriggersFromPayload(object? payload, Chain chain)
    {
        var triggers = new List<(IntegrationProvider, Chain)>();

        if (payload == null)
        {
            _logger.LogDebug("UniswapV3NftDetector: Null payload received for chain {Chain}", chain);
            return triggers;
        }

        try
        {
            // Payload is MoralisGetNFTsResponse with Result property containing NFT array
            var jsonElement = JsonSerializer.SerializeToElement(payload);
            
            // Try to extract the "result" array from MoralisGetNFTsResponse
            JsonElement nftArray;
            if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("result", out var resultProp))
            {
                nftArray = resultProp;
            }
            else if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("Result", out var resultPropUpper))
            {
                nftArray = resultPropUpper;
            }
            else if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                nftArray = jsonElement; // Already an array
            }
            else
            {
                _logger.LogWarning("UniswapV3NftDetector: Could not extract NFT array from payload for chain {Chain}", chain);
                return triggers;
            }

            var nftCount = nftArray.GetArrayLength();
            _logger.LogDebug("UniswapV3NftDetector: Scanning {Count} NFTs for chain {Chain}", nftCount, chain);

            // Check if any NFT matches Uniswap V3 position manager contract
            if (UniswapV3NftContracts.TryGetValue(chain, out var uniswapContract))
            {
                var uniswapContractLower = uniswapContract.ToLowerInvariant();
                
                foreach (var nft in nftArray.EnumerateArray())
                {
                    if (nft.TryGetProperty("contract_address", out var contractAddr) ||
                        nft.TryGetProperty("token_address", out contractAddr) ||
                        nft.TryGetProperty("contractAddress", out contractAddr))
                    {
                        var contract = contractAddr.GetString()?.ToLowerInvariant();
                        
                        if (contract == uniswapContractLower)
                        {
                            // Check if UniswapV3 is enabled on this chain before triggering
                            if (!_protocolConfig.IsProtocolEnabledOnChain("uniswap-v3", chain))
                            {
                                _logger.LogDebug(
                                    "UniswapV3NftDetector: Uniswap V3 NFT found on {Chain} but protocol is disabled - skipping trigger",
                                    chain);
                                break;
                            }
                            
                            _logger.LogInformation(
                                "UniswapV3NftDetector: TRIGGER DETECTED - Uniswap V3 NFT found on {Chain} (contract={Contract})",
                                chain, uniswapContract);
                            
                            triggers.Add((IntegrationProvider.UniswapV3Positions, chain));
                            break; // Only need to trigger once per chain
                        }
                    }
                }
            }
            else
            {
                _logger.LogDebug("UniswapV3NftDetector: Chain {Chain} not configured for Uniswap V3", chain);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UniswapV3NftDetector: Error processing payload for chain {Chain}", chain);
        }

        if (triggers.Count > 0)
        {
            _logger.LogInformation("UniswapV3NftDetector: Returning {Count} triggers for chain {Chain}", triggers.Count, chain);
        }

        return triggers;
    }
}
