using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using System.Text.Json;

namespace DeFi10.API.Messaging.Workers.TriggerRules;

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

        _logger.LogDebug("UniswapV3NftDetector: Starting detection for chain {Chain}", chain);

        if (payload == null)
        {
            _logger.LogWarning("UniswapV3NftDetector: Null payload received for chain {Chain}", chain);
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
                _logger.LogDebug("UniswapV3NftDetector: Extracted 'result' property from payload");
            }
            else if (jsonElement.ValueKind == JsonValueKind.Object && jsonElement.TryGetProperty("Result", out var resultPropUpper))
            {
                nftArray = resultPropUpper;
                _logger.LogDebug("UniswapV3NftDetector: Extracted 'Result' property from payload");
            }
            else if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                nftArray = jsonElement; // Already an array
                _logger.LogDebug("UniswapV3NftDetector: Payload is already an array");
            }
            else
            {
                _logger.LogWarning("UniswapV3NftDetector: Could not extract NFT array from payload for chain {Chain}. PayloadKind={Kind}", 
                    chain, jsonElement.ValueKind);
                return triggers;
            }

            var nftCount = nftArray.GetArrayLength();
            _logger.LogDebug("UniswapV3NftDetector: Scanning {Count} NFTs for chain {Chain}", nftCount, chain);

            // Check if any NFT matches Uniswap V3 position manager contract
            if (UniswapV3NftContracts.TryGetValue(chain, out var uniswapContract))
            {
                var uniswapContractLower = uniswapContract.ToLowerInvariant();
                _logger.LogDebug("UniswapV3NftDetector: Looking for Uniswap V3 contract: {Contract}", uniswapContract);
                
                var nftIndex = 0;
                foreach (var nft in nftArray.EnumerateArray())
                {
                    nftIndex++;
                    
                    string? contractAddress = null;
                    if (nft.TryGetProperty("contract_address", out var contractAddr))
                    {
                        contractAddress = contractAddr.GetString();
                        _logger.LogDebug("UniswapV3NftDetector: NFT #{Index} - contract_address: {Contract}", nftIndex, contractAddress);
                    }
                    else if (nft.TryGetProperty("token_address", out contractAddr))
                    {
                        contractAddress = contractAddr.GetString();
                        _logger.LogDebug("UniswapV3NftDetector: NFT #{Index} - token_address: {Contract}", nftIndex, contractAddress);
                    }
                    else if (nft.TryGetProperty("contractAddress", out contractAddr))
                    {
                        contractAddress = contractAddr.GetString();
                        _logger.LogDebug("UniswapV3NftDetector: NFT #{Index} - contractAddress: {Contract}", nftIndex, contractAddress);
                    }
                    else
                    {
                        _logger.LogDebug("UniswapV3NftDetector: NFT #{Index} - No contract address found in NFT properties", nftIndex);
                        
                        // Log all properties for debugging
                        var properties = new List<string>();
                        foreach (var prop in nft.EnumerateObject())
                        {
                            properties.Add(prop.Name);
                        }
                        _logger.LogDebug("UniswapV3NftDetector: NFT #{Index} properties: {Properties}", nftIndex, string.Join(", ", properties));
                        continue;
                    }
                    
                    if (contractAddress != null)
                    {
                        var contract = contractAddress.ToLowerInvariant();
                        
                        if (contract == uniswapContractLower)
                        {
                            // Check if UniswapV3 is enabled on this chain before triggering
                            if (!_protocolConfig.IsProtocolEnabledOnChain("uniswap-v3", chain))
                            {
                                _logger.LogWarning(
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
                        else
                        {
                            _logger.LogDebug("UniswapV3NftDetector: NFT #{Index} contract {Contract} does not match Uniswap V3 contract {Expected}",
                                nftIndex, contractAddress, uniswapContract);
                        }
                    }
                }
                
                if (triggers.Count == 0)
                {
                    _logger.LogDebug("UniswapV3NftDetector: No Uniswap V3 NFTs found after scanning {Count} NFTs on {Chain}", 
                        nftCount, chain);
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
        else
        {
            _logger.LogDebug("UniswapV3NftDetector: No triggers detected for chain {Chain}", chain);
        }

        return triggers;
    }
}
