using MyWebWallet.API.Models;
using MyWebWallet.API.Configuration;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IChainConfigurationService
    {
        /// <summary>
        /// Gets configuration for a specific chain
        /// </summary>
        ChainConfig? GetChainConfig(ChainEnum chain);
        
        /// <summary>
        /// Gets configuration for a specific chain by name
        /// </summary>
        ChainConfig? GetChainConfig(string chainName);
        
        /// <summary>
        /// Gets all enabled chains
        /// </summary>
        IEnumerable<ChainEnum> GetEnabledChains();
        
        /// <summary>
        /// Gets all available chains (enabled and disabled)
        /// </summary>
        IEnumerable<ChainEnum> GetAllChains();
        
        /// <summary>
        /// Checks if a chain is enabled
        /// </summary>
        bool IsChainEnabled(ChainEnum chain);
        
        /// <summary>
        /// Gets RPC URL for a chain with fallback logic
        /// </summary>
        string? GetRpcUrl(ChainEnum chain, string? alchemyApiKey = null);
        
        /// <summary>
        /// Gets protocol-specific configuration
        /// </summary>
        T? GetProtocolConfig<T>(ChainEnum chain) where T : class;
        
        /// <summary>
        /// Gets Uniswap V3 configuration for a chain
        /// </summary>
        UniswapV3Config? GetUniswapV3Config(ChainEnum chain);
        
        /// <summary>
        /// Gets Aave configuration for a chain
        /// </summary>
        AaveConfig? GetAaveConfig(ChainEnum chain);
        
        /// <summary>
        /// Gets Moralis configuration for a chain
        /// </summary>
        MoralisConfig? GetMoralisConfig(ChainEnum chain);
        
        /// <summary>
        /// Validates chain configuration
        /// </summary>
        ChainValidationResult ValidateChainConfig(ChainEnum chain);
    }

    public class ChainValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
    }
}