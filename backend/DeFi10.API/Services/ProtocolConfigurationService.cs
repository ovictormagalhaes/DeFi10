using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services;

public class ProtocolConfigurationService : IProtocolConfigurationService
{
    private readonly ProtocolConfigurationOptions _options;
    private readonly Dictionary<string, ProtocolDefinition> _map;
    private readonly ILogger<ProtocolConfigurationService> _logger;

    public ProtocolConfigurationService(IOptions<ProtocolConfigurationOptions> options, ILogger<ProtocolConfigurationService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _map = BuildMap(_options);
        
        // Log protocol configuration at startup
        LogProtocolConfiguration();
    }

    private void LogProtocolConfiguration()
    {
        _logger.LogDebug("Protocol configuration loaded");
        _logger.LogDebug("Total protocols in map: {Count}", _map.Count);
        foreach (var kv in _map)
        {
            _logger.LogDebug("Protocol Key: '{ProtocolId}'", kv.Key);
            if (kv.Value.ChainSupports != null)
            {
                foreach (var support in kv.Value.ChainSupports)
                {
                    var enabledValue = support.Options?.TryGetValue("Enabled", out var enabled) == true ? enabled : "NOT_SET";
                    _logger.LogDebug("  Chain: {Chain}, Enabled: {Enabled}", support.Chain, enabledValue);
                }
            }
        }
    }

    private static Dictionary<string, ProtocolDefinition> BuildMap(ProtocolConfigurationOptions opts)
    {
        var dict = new Dictionary<string, ProtocolDefinition>(StringComparer.OrdinalIgnoreCase);
        
        // Add by Key property (e.g., "aave-v3", "uniswap-v3") AND by property name for compatibility
        if (opts.AaveV3 != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.AaveV3.Key)) dict[opts.AaveV3.Key] = opts.AaveV3;
            dict[nameof(opts.AaveV3)] = opts.AaveV3;
        }
        
        if (opts.Moralis != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.Moralis.Key)) dict[opts.Moralis.Key] = opts.Moralis;
            dict[nameof(opts.Moralis)] = opts.Moralis;
        }
        
        if (opts.UniswapV3 != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.UniswapV3.Key)) dict[opts.UniswapV3.Key] = opts.UniswapV3;
            dict[nameof(opts.UniswapV3)] = opts.UniswapV3;
        }
        
        if (opts.PendleV2 != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.PendleV2.Key)) dict[opts.PendleV2.Key] = opts.PendleV2;
            dict[nameof(opts.PendleV2)] = opts.PendleV2;
        }
        
        if (opts.SolanaWallet != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.SolanaWallet.Key)) dict[opts.SolanaWallet.Key] = opts.SolanaWallet;
            dict[nameof(opts.SolanaWallet)] = opts.SolanaWallet;
        }
        
        if (opts.Raydium != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.Raydium.Key)) dict[opts.Raydium.Key] = opts.Raydium;
            dict[nameof(opts.Raydium)] = opts.Raydium;
        }
        
        if (opts.Kamino != null)
        {
            if (!string.IsNullOrWhiteSpace(opts.Kamino.Key)) dict[opts.Kamino.Key] = opts.Kamino;
            dict[nameof(opts.Kamino)] = opts.Kamino;
        }

        foreach (var kv in opts.Extra)
        {
            if (!dict.ContainsKey(kv.Key)) dict[kv.Key] = kv.Value;
        }
        
        return dict;
    }

    public ProtocolDefinition? GetProtocol(string protocolId)
    {
        if (string.IsNullOrWhiteSpace(protocolId)) return null;
        var found = _map.TryGetValue(protocolId, out var def);
        _logger.LogDebug("GetProtocol: protocolId='{ProtocolId}', found={Found}", protocolId, found);
        return found ? def : null;
    }

    public IEnumerable<string> GetRegisteredProtocolIds() => _map.Keys;

    public IEnumerable<ProtocolChainResolved> GetEnabledChains(string protocolId)
    {
        var def = GetProtocol(protocolId);
        if (def == null) yield break;
        foreach (var support in def.ChainSupports)
        {
            if (!Enum.TryParse<ChainEnum>(support.Chain, true, out var chainEnum)) continue;
            yield return new ProtocolChainResolved(protocolId, chainEnum, support.Options);
        }
    }

    public IEnumerable<ChainEnum> GetAllConfiguredChains(string protocolId)
    {
        var def = GetProtocol(protocolId);
        if (def == null) yield break;
        foreach (var support in def.ChainSupports)
        {
            if (Enum.TryParse<ChainEnum>(support.Chain, true, out var chainEnum))
            {
                yield return chainEnum;
            }
        }
    }

    public ProtocolChainResolved? GetProtocolOnChain(string protocolId, ChainEnum chain)
    {
        var def = GetProtocol(protocolId);
        if (def == null)
        {
            _logger.LogDebug("GetProtocolOnChain: Protocol '{ProtocolId}' not found", protocolId);
            return null;
        }
        var entry = def.ChainSupports.FirstOrDefault(c => string.Equals(c.Chain, chain.ToString(), StringComparison.OrdinalIgnoreCase));
        if (entry == null)
        {
            _logger.LogDebug("GetProtocolOnChain: Chain '{Chain}' not configured for protocol '{ProtocolId}'", chain, protocolId);
            return null;
        }
        return new ProtocolChainResolved(protocolId, chain, entry.Options);
    }

    public bool IsProtocolEnabledOnChain(string protocolId, ChainEnum chain)
    {
        var result = GetProtocolOnChain(protocolId, chain);
        var isEnabled = result?.Enabled == true;
        
        _logger.LogInformation("IsProtocolEnabledOnChain: protocol='{Protocol}', chain={Chain}, enabled={Enabled}", 
            protocolId, chain, isEnabled);
        
        return isEnabled;
    }
}