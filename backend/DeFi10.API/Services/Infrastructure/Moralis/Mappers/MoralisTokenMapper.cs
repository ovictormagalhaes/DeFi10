using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Infrastructure.Moralis.Models;

namespace DeFi10.API.Services.Infrastructure.Moralis.Mappers;

public class MoralisTokenMapper : IWalletItemMapper<IEnumerable<TokenDetail>>
{
    private readonly IChainConfigurationService _chainConfig;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly bool _filterZeroPriceTokens;
    private readonly ILogger<MoralisTokenMapper> _logger;

    public MoralisTokenMapper(
        IChainConfigurationService chainConfigurationService, 
        IProtocolConfigurationService protocolConfigurationService,
        IOptions<MoralisOptions> options,
        ILogger<MoralisTokenMapper> logger)
    { 
        _chainConfig = chainConfigurationService; 
        _protocolConfig = protocolConfigurationService;
        _filterZeroPriceTokens = options.Value.FilterZeroPriceTokens;
        _logger = logger;
    }

    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);
    
    public IEnumerable<ChainEnum> GetSupportedChains() => 
        _protocolConfig.GetEnabledChainEnums(ProtocolNames.Moralis, "Solana");

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol(ProtocolNames.Moralis) ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.Moralis}");
        return def.ToProtocol(chain, _chainConfig);
    }

    public async Task<List<WalletItem>> MapAsync(IEnumerable<TokenDetail> tokens, ChainEnum chain)
    {
        if (!SupportsChain(chain)) throw new NotSupportedException($"Chain {chain} is not supported by Moralis");
        var protocol = GetProtocolDefinition(chain);
        
        var walletItems = new List<WalletItem>();
        
        foreach (var token in tokens ?? Enumerable.Empty<TokenDetail>())
        {
            decimal.TryParse(token.Balance, out var balance);
            var decimals = token.Decimals ?? 1;
            var balanceFormatted = decimals > 0 ? balance / (decimal)Math.Pow(10, decimals) : balance;
            
            // Filter tokens with zero or negative balance
            if (balanceFormatted <= 0)
            {
                _logger.LogDebug("Filtered token with zero balance: {Symbol} ({Name}) - Address: {Address}", 
                    token.Symbol, token.Name, token.TokenAddress);
                continue;
            }
            
            // Filter tokens with zero price if feature flag is enabled
            if (_filterZeroPriceTokens && token.UsdPrice == 0)
            {
                _logger.LogDebug("Filtered token with zero price: {Symbol} ({Name}) - Address: {Address}", 
                    token.Symbol, token.Name, token.TokenAddress);
                continue;
            }
            
            walletItems.Add(new WalletItem
            {
                Type = WalletItemType.Wallet,
                Protocol = protocol,
                Position = new Position
                {
                    Label = "Wallet",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Name = token.Name,
                            Chain = protocol.Chain,
                            Symbol = token.Symbol,
                            ContractAddress = token.TokenAddress,
                            Logo = string.IsNullOrEmpty(token.Logo) ? token.Thumbnail : token.Logo,
                            Thumbnail = token.Thumbnail,
                            Financials = new TokenFinancials
                            {
                                Amount = balance,
                                DecimalPlaces = decimals,
                                BalanceFormatted = balanceFormatted,
                                Price = (decimal?)token.UsdPrice,
                                TotalPrice = (decimal?)token.UsdPrice * balanceFormatted
                            },
                            Native = token.VerifiedContract ? false : (bool?)null,
                            PossibleSpam = token.PossibleSpam || token.UsdPrice == 0
                        }
                    }
                }
            });
        }
        
        return await Task.FromResult(walletItems);
    }
}