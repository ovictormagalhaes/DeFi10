using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation;

namespace MyWebWallet.API.Services.Mappers;

public class PendleDepositsMapper : IWalletItemMapper<PendleDepositsResponse>
{
    private readonly ILogger<PendleDepositsMapper> _logger;
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;

    private const string PROTOCOL_ID = "pendle-v2-deposits";

    public PendleDepositsMapper(ILogger<PendleDepositsMapper> logger, ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
    { _logger = logger; _tokenFactory = tokenFactory; _protocolConfig = protocolConfig; _chainConfig = chainConfig; }

    public bool SupportsChain(ChainEnum chain)
    {
        // Only Base enabled by request
        return chain == ChainEnum.Base;
    }

    public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Base };

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol("pendle-v2");
        var chainSlug = _chainConfig.GetChainConfig(chain)?.Slug ?? chain.ToString().ToLowerInvariant();
        // Fallback protocol descriptor if missing in config
        return new Protocol
        {
            Name = "Pendle V2",
            Chain = chainSlug,
            Id = PROTOCOL_ID,
            Url = "https://app.pendle.finance",
            Logo = "https://logo.moralis.io/0xa4b1_0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8_0270cab3e068234013aa17f290e4b6cb.png"
        };
    }

    public async Task<List<WalletItem>> MapAsync(PendleDepositsResponse response, ChainEnum chain)
    {
        _logger.LogInformation("[PendleDepositsMapper] MapAsync called - Chain: {Chain}", chain);
        
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
        
        _logger.LogInformation("[PendleDepositsMapper] Found {Count} deposits to map", response.Data.Deposits.Count);
        
        var protocol = GetProtocolDefinition(chain);
        _logger.LogInformation("[PendleDepositsMapper] Protocol: {Name} ({Id})", protocol.Name, protocol.Id);

        foreach (var d in response.Data.Deposits)
        {
            try
            {
                _logger.LogInformation("[PendleDepositsMapper] Mapping deposit: {Symbol} amount={Amount} underlying={Underlying}", 
                    d.MarketSymbol, d.AmountFormatted, d.UnderlyingSymbol);
                
                var supplied = _tokenFactory.CreateSupplied(
                    name: d.MarketSymbol,
                    symbol: d.UnderlyingSymbol ?? d.MarketSymbol,  // ? Usar underlying symbol (USDe, cbBTC)
                    contract: d.PtAddress,
                    chain: chain,
                    decimals: d.PtDecimals,
                    formattedAmount: d.AmountFormatted,
                    unitPriceUsd: 0m  // ? Deixar 0 - PriceService vai preencher automaticamente
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
                _logger.LogInformation("[PendleDepositsMapper] ? Successfully mapped deposit: {Symbol} (underlying: {Underlying})", 
                    d.MarketSymbol, d.UnderlyingSymbol);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[PendleDepositsMapper] Failed mapping market={Market}", d.MarketSymbol);
            }
        }

        _logger.LogInformation("[PendleDepositsMapper] MapAsync complete - Returning {Count} items", items.Count);
        return await Task.FromResult(items);
    }
}
