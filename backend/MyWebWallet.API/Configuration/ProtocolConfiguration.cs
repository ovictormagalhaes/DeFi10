using System.Collections.Concurrent;
using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Configuration;

// Root options object bound from configuration section: ProtocolConfiguration
public class ProtocolConfigurationOptions
{
    public ProtocolDefinition? AaveV3 { get; set; }
    public ProtocolDefinition? Moralis { get; set; }
    public ProtocolDefinition? UniswapV3 { get; set; }
    public ProtocolDefinition? PendleV2 { get; set; } // novo protocolo

    // Generic support (in case future protocols want to register dynamically)
    public Dictionary<string, ProtocolDefinition> Extra { get; set; } = new();

    private Dictionary<string, ProtocolDefinition>? _index; // normalized key/alias -> definition
    private readonly object _lock = new();

    private void EnsureIndex()
    {
        if (_index != null) return;
        lock (_lock)
        {
            if (_index != null) return;
            var map = new Dictionary<string, ProtocolDefinition>(StringComparer.OrdinalIgnoreCase);

            void Add(string sourceKey, ProtocolDefinition? def)
            {
                if (def == null) return;
                if (string.IsNullOrWhiteSpace(def.Key)) def.Key = ToKebab(sourceKey);
                if (!map.ContainsKey(def.Key)) map[def.Key] = def;
                var variations = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    def.Key,
                    sourceKey,
                    sourceKey.ToLowerInvariant(),
                    ToKebab(sourceKey),
                };
                if (!string.IsNullOrWhiteSpace(def.DisplayName)) variations.Add(def.DisplayName);
                if (def.Aliases != null)
                {
                    foreach (var a in def.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)))
                    {
                        variations.Add(a!);
                        variations.Add(ToKebab(a!));
                        variations.Add(a!.ToLowerInvariant());
                    }
                }
                foreach (var v in variations)
                {
                    if (!map.ContainsKey(v)) map[v] = def;
                }
            }

            Add(nameof(AaveV3), AaveV3);
            Add(nameof(Moralis), Moralis);
            Add(nameof(UniswapV3), UniswapV3);
            Add(nameof(PendleV2), PendleV2);
            foreach (var kv in Extra)
            {
                if (kv.Value != null && string.IsNullOrWhiteSpace(kv.Value.Key)) kv.Value.Key = ToKebab(kv.Key);
                Add(kv.Key, kv.Value);
            }
            _index = map;
        }
    }

    private static string ToKebab(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        var chars = new List<char>(s.Length * 2);
        for (int i = 0; i < s.Length; i++)
        {
            var c = s[i];
            if (char.IsUpper(c) && i > 0 && (char.IsLower(s[i - 1]) || (i + 1 < s.Length && char.IsLower(s[i + 1]))))
                chars.Add('-');
            chars.Add(char.ToLowerInvariant(c));
        }
        return new string(chars.ToArray());
    }

    public ProtocolDefinition? GetByKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        EnsureIndex();
        return _index!.TryGetValue(key.Trim(), out var def) ? def : null;
    }
}

// Unified protocol definition (all protocols use / inherit this structure)
public class ProtocolDefinition
{
    public string? Key { get; set; }
    public List<string>? Aliases { get; set; }
    public string? DisplayName { get; set; }
    public string? Icon { get; set; }
    public string? Website { get; set; }
    public string? Documentation { get; set; }
    public List<ProtocolChainSupport> ChainSupports { get; set; } = new();
    public Dictionary<string, string>? Metadata { get; set; }
}

public class ProtocolChainSupport
{
    public string Chain { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public Dictionary<string, string> Settings { get; set; } = new();
}

public sealed class ProtocolChainResolved
{
    public string ProtocolId { get; }
    public ChainEnum Chain { get; }
    public bool Enabled { get; }
    public IReadOnlyDictionary<string, string> Settings { get; }

    public ProtocolChainResolved(string protocolId, ChainEnum chain, bool enabled, IReadOnlyDictionary<string,string> settings)
    {
        ProtocolId = protocolId;
        Chain = chain;
        Enabled = enabled;
        Settings = settings;
    }
}
