using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Configuration
{
    /// <summary>
    /// Configuration model for blockchain chains
    /// </summary>
    public class ChainConfiguration
    {
        public Dictionary<string, ChainConfig> Chains { get; set; } = new();
        
        public ChainConfig? GetChainConfig(ChainEnum chain)
        {
            var key = chain.ToString();
            return Chains.TryGetValue(key, out var config) ? config : null;
        }
        
        public ChainConfig? GetChainConfig(string chainName)
        {
            return Chains.TryGetValue(chainName, out var config) ? config : null;
        }
    }

    public class ChainConfig
    {
        public string DisplayName { get; set; } = string.Empty;
        public int ChainId { get; set; }
        public string NativeCurrency { get; set; } = "ETH";
        public string IconUrl { get; set; } = string.Empty;
        public string? Slug { get; set; } // new configurable chain slug (e.g. base, bsc, arbitrum)
        public RpcConfiguration Rpc { get; set; } = new();
        public ProtocolSupport Protocols { get; set; } = new();
        public PriceFeeds PriceFeeds { get; set; } = new();
        public bool IsEnabled { get; set; } = true;
    }

    public class RpcConfiguration
    {
        public string? Primary { get; set; }
        public string? Alchemy { get; set; }
        public List<string> Fallbacks { get; set; } = new();
        public int TimeoutMs { get; set; } = 10000;
        public int MaxRetries { get; set; } = 3;
    }

    public class ProtocolSupport
    {
        public UniswapV3Config? UniswapV3 { get; set; }
        public AaveConfig? Aave { get; set; }
        public MoralisConfig? Moralis { get; set; }
    }

    public class UniswapV3Config
    {
        public bool IsEnabled { get; set; } = true;
        public string Factory { get; set; } = string.Empty;
        public string PositionManager { get; set; } = string.Empty;
        public string? PoolInitCodeHash { get; set; }
        public Dictionary<string, string> AdditionalContracts { get; set; } = new();
    }

    public class AaveConfig
    {
        public bool IsEnabled { get; set; } = true;
        public string PoolAddressesProvider { get; set; } = string.Empty;
        public string Pool { get; set; } = string.Empty;
        public Dictionary<string, string> AdditionalContracts { get; set; } = new();
    }

    public class MoralisConfig
    {
        public bool IsEnabled { get; set; } = true;
        public string ChainId { get; set; } = string.Empty;
        public Dictionary<string, object> AdditionalConfig { get; set; } = new();
    }

    public class PriceFeeds
    {
        public ChainlinkConfig? Chainlink { get; set; }
        public Dictionary<string, string> AdditionalFeeds { get; set; } = new();
    }

    public class ChainlinkConfig
    {
        public string? NativeUsdAggregator { get; set; }
        public int Decimals { get; set; } = 8;
        public Dictionary<string, string> TokenPairs { get; set; } = new();
    }
}