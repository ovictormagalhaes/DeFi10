using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation;
using System.Globalization;
using MyWebWallet.API.Configuration;

namespace MyWebWallet.API.Services.Mappers;

public class PendleVeMapper : IWalletItemMapper<PendleVePositionsResponse>
{
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;
    private readonly string _protocolKey; // resolved dynamically from config

    public PendleVeMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
    {
        _tokenFactory = tokenFactory;
        _protocolConfig = protocolConfig;
        _chainConfig = chainConfig;
        _protocolKey = _protocolConfig.GetRegisteredProtocolIds()
            .Select(id => _protocolConfig.GetProtocol(id))
            .Where(def => def != null && !string.IsNullOrWhiteSpace(def.Key))
            .FirstOrDefault(def => def!.ChainSupports.Any(cs => cs.Settings != null && cs.Settings.ContainsKey("pendleToken")))?.Key
            ?? throw new InvalidOperationException("Pendle protocol not configured (no protocol definition exposes 'pendleToken' setting).");
    }

    public bool SupportsChain(ChainEnum chain) => chain == ChainEnum.Ethereum;
    public IEnumerable<ChainEnum> GetSupportedChains() => new [] { ChainEnum.Ethereum };

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol(_protocolKey!) ?? throw new InvalidOperationException($"Protocol configuration missing for {_protocolKey}");
        // Usa extensão para validar metadados e suporte na chain
        var protocol = def.ToProtocol(chain, _chainConfig);
        // Garantir presença do pendleToken na configuração da chain
        var chainResolved = _protocolConfig.GetProtocolOnChain(_protocolKey, chain) ?? throw new InvalidOperationException($"Protocol {_protocolKey} not enabled on chain {chain}");
        if (!chainResolved.Settings.ContainsKey("pendleToken")) throw new InvalidOperationException($"pendleToken setting missing for protocol {_protocolKey} chain {chain}");
        return protocol;
    }

    public async Task<List<WalletItem>> MapAsync(PendleVePositionsResponse input, ChainEnum chain)
    {
        var list = new List<WalletItem>();
        if (!SupportsChain(chain)) throw new NotSupportedException($"Chain {chain} not supported by {_protocolKey}");
        if (input?.Data?.Locks == null) return list;

        var protocol = GetProtocolDefinition(chain);
        var chainResolved = _protocolConfig.GetProtocolOnChain(_protocolKey, chain)!;
        var pendleTokenAddr = chainResolved.Settings["pendleToken"];

        foreach (var lockPos in input.Data.Locks)
        {
            try
            {
                if (!decimal.TryParse(lockPos.AmountFormatted, NumberStyles.Float, CultureInfo.InvariantCulture, out var rawAmount)) rawAmount = 0m;
                if (!decimal.TryParse(lockPos.VeBalance, NumberStyles.Float, CultureInfo.InvariantCulture, out var veBalance)) veBalance = 0m;

                var pendleToken = _tokenFactory.CreateSupplied(
                    name: "Pendle Locked",
                    symbol: "PENDLE",
                    contract: pendleTokenAddr,
                    chain: chain,
                    decimals: 18,
                    formattedAmount: rawAmount,
                    unitPriceUsd: 0
                );

                var veToken = _tokenFactory.CreateGovernancePower(
                    name: "vePENDLE Governance Power",
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
