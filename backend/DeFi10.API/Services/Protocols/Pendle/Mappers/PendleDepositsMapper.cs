using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Configuration;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Aggregation;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Pendle.Models;

namespace DeFi10.API.Services.Protocols.Pendle.Mappers;

public class PendleDepositsMapper : IWalletItemMapper<PendleDepositsResponse>
{
    private readonly ILogger<PendleDepositsMapper> _logger;
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;

    public PendleDepositsMapper(ILogger<PendleDepositsMapper> logger, ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
    { _logger = logger; _tokenFactory = tokenFactory; _protocolConfig = protocolConfig; _chainConfig = chainConfig; }

    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);

    public IEnumerable<ChainEnum> GetSupportedChains() => 
        _protocolConfig.GetEnabledChainEnums(ProtocolNames.PendleV2);

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol(ProtocolNames.PendleV2) 
            ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.PendleV2}");
        return def.ToProtocol(chain, _chainConfig);
    }

    public async Task<List<WalletItem>> MapAsync(PendleDepositsResponse response, ChainEnum chain)
    {
        _logger.LogDebug("[PendleDepositsMapper] MapAsync called - Chain: {Chain}", chain);
        
        var items = new List<WalletItem>();
        
        if (response == null)
        {
            _logger.LogWarning("[PendleDepositsMapper] Response is NULL");
            return items;
        }
        
        if (response.Data == null)
        {
            _logger.LogWarning("[PendleDepositsMapper] Response.Data is NULL");
            return items;
        }
        
        if (response.Data.Deposits == null)
        {
            _logger.LogWarning("[PendleDepositsMapper] Response.Data.Deposits is NULL");
            return items;
        }
        
        _logger.LogDebug("[PendleDepositsMapper] Found {Count} deposits to map", response.Data.Deposits.Count);
        
        var protocol = GetProtocolDefinition(chain);
        _logger.LogDebug("[PendleDepositsMapper] Protocol: {Name} ({Id})", protocol.Name, protocol.Id);

        foreach (var d in response.Data.Deposits)
        {
            try
            {
                _logger.LogDebug("[PendleDepositsMapper] Mapping deposit: {Symbol} amount={Amount} underlying={Underlying}", 
                    d.MarketSymbol, d.AmountFormatted, d.UnderlyingSymbol);
                
                var supplied = _tokenFactory.CreateSupplied(
                    name: d.MarketSymbol,
                    symbol: d.UnderlyingSymbol ?? d.MarketSymbol,
                    contract: d.PtAddress,
                    chain: chain,
                    decimals: d.PtDecimals,
                    formattedAmount: d.AmountFormatted,
                    unitPriceUsd: 0m
                );

                var wi = new WalletItem
                {
                    Type = WalletItemType.Depositing,
                    Protocol = protocol,
                    Position = new Position
                    {
                        Label = "Deposit",
                        Tokens = [ supplied ]
                    },
                    AdditionalData = new AdditionalData
                    {
                        UnlockAt = d.MaturityUnix
                    }
                };
                
                items.Add(wi);
                _logger.LogDebug("[PendleDepositsMapper] Successfully mapped deposit: {Symbol} (underlying: {Underlying})", 
                    d.MarketSymbol, d.UnderlyingSymbol);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PendleDepositsMapper] Failed mapping market={Market}", d.MarketSymbol);
            }
        }

        _logger.LogDebug("[PendleDepositsMapper] MapAsync complete - Returning {Count} items", items.Count);
        return await Task.FromResult(items);
    }
}
