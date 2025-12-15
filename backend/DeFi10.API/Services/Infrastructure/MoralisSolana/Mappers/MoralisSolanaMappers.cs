using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Domain.Mappers;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana.Mappers
{
    public sealed class MoralisSolanaMapper : IWalletItemMapper<SolanaTokenResponse>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly IChainConfigurationService _chainConfig;

        public MoralisSolanaMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
        {
            _tokenFactory = tokenFactory;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
        }

        public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);
        
        public IEnumerable<ChainEnum> GetSupportedChains() => 
            _protocolConfig.GetEnabledChainEnums(ProtocolNames.SolanaWallet);

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            var def = _protocolConfig.GetProtocol(ProtocolNames.SolanaWallet) 
                ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.SolanaWallet}");
            return def.ToProtocol(chain, _chainConfig);
        }

        public Task<List<WalletItem>> MapAsync(SolanaTokenResponse source, ChainEnum chain)
        {
            var walletItems = new List<WalletItem>();

            if (source?.Tokens == null || !source.Tokens.Any())
            {
                return Task.FromResult(walletItems);
            }

            var tokens = source.Tokens.Select(t =>
            {
                var token = _tokenFactory.CreateSupplied(
                    t.Name ?? "Unknown Token",
                    t.Symbol ?? "UNKNOWN",
                    t.Mint,
                    chain,
                    t.Decimals,
                    t.Amount,
                    t.PriceUsd ?? 0
                );

                token.Logo = t.Logo;
                return token;
            }).ToList();

            var walletItem = new WalletItem
            {
                Type = WalletItemType.Wallet,
                Protocol = GetProtocolDefinition(chain),
                Position = new Position
                {
                    Label = "Wallet",
                    Tokens = tokens
                },
                AdditionalData = new AdditionalData()
            };

            walletItems.Add(walletItem);

            return Task.FromResult(walletItems);
        }
    }

}
