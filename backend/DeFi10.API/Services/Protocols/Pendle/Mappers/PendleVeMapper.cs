using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Aggregation;
using System.Globalization;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Pendle.Models;

namespace DeFi10.API.Services.Protocols.Pendle.Mappers;

public class PendleVeMapper : IWalletItemMapper<PendleVePositionsResponse>
{
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;

    public PendleVeMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
    {
        _tokenFactory = tokenFactory;
        _protocolConfig = protocolConfig;
        _chainConfig = chainConfig;
    }

    public bool SupportsChain(ChainEnum chain) => 
        _protocolConfig.IsChainEnabledForProtocol(ProtocolNames.PendleV2, chain);
    
    public IEnumerable<ChainEnum> GetSupportedChains() => 
        _protocolConfig.GetEnabledChainEnums(ProtocolNames.PendleV2);

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol(ProtocolNames.PendleV2) 
            ?? throw new InvalidOperationException($"Protocol configuration missing for {ProtocolNames.PendleV2}");

        return def.ToProtocol(chain, _chainConfig);
    }

    public async Task<List<WalletItem>> MapAsync(PendleVePositionsResponse input, ChainEnum chain)
    {
        var list = new List<WalletItem>();
        if (!SupportsChain(chain)) throw new NotSupportedException($"Chain {chain} not supported by {ProtocolNames.PendleV2}");
        if (input?.Data?.Locks == null) return list;

        var protocol = GetProtocolDefinition(chain);
        var chainResolved = _protocolConfig.GetProtocolOnChain(ProtocolNames.PendleV2, chain) 
            ?? throw new InvalidOperationException($"Protocol {ProtocolNames.PendleV2} not enabled on chain {chain}");
        
        if (!chainResolved.Options.TryGetValue("pendleToken", out var pendleTokenAddr) || string.IsNullOrWhiteSpace(pendleTokenAddr))
            throw new InvalidOperationException($"pendleToken setting missing for protocol {ProtocolNames.PendleV2} chain {chain}");
        
        pendleTokenAddr = pendleTokenAddr.Trim();

        foreach (var lockPos in input.Data.Locks)
        {
            try
            {
                if (!decimal.TryParse(lockPos.AmountFormatted, NumberStyles.Float, CultureInfo.InvariantCulture, out var rawAmount)) rawAmount = 0m;
                if (!decimal.TryParse(lockPos.VeBalance, NumberStyles.Float, CultureInfo.InvariantCulture, out var veBalance)) veBalance = 0m;

                var pendleToken = _tokenFactory.CreateSupplied(
                    name: string.Empty,
                    symbol: "PENDLE",
                    contract: pendleTokenAddr,
                    chain: chain,
                    decimals: 18,
                    formattedAmount: rawAmount,
                    unitPriceUsd: 0
                );

                var veToken = _tokenFactory.CreateGovernancePower(
                    name: string.Empty,
                    symbol: "vePENDLE",
                    contract: string.Empty,
                    chain: chain,
                    decimals: 18,
                    formattedAmount: veBalance
                );

                list.Add(new WalletItem
                {
                    Type = WalletItemType.Locking,
                    Protocol = protocol,
                    Position = new Position { Label = "vePENDLE Lock", Tokens = new List<Token> { pendleToken, veToken } },
                    AdditionalData = new AdditionalData { UnlockAt = lockPos.UnlockTime }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"PendleVeMapper error lockId={lockPos.LockId}: {ex.Message}");
            }
        }
        return await Task.FromResult(list);
    }
}