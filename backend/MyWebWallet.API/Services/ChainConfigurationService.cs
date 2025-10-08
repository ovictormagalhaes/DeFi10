using MyWebWallet.API.Models;
using MyWebWallet.API.Configuration;
using MyWebWallet.API.Services.Interfaces;
using Microsoft.Extensions.Options;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services
{
    public class ChainConfigurationService : IChainConfigurationService
    {
        private readonly ChainConfiguration _configuration;
        private readonly ILogger<ChainConfigurationService> _logger;

        public ChainConfigurationService(IOptions<ChainConfiguration> configuration, ILogger<ChainConfigurationService> logger)
        {
            _configuration = configuration.Value;
            _logger = logger;
        }

        public ChainConfig? GetChainConfig(ChainEnum chain) => _configuration.GetChainConfig(chain);
        public ChainConfig? GetChainConfig(string chainName) => _configuration.GetChainConfig(chainName);
        public IEnumerable<ChainEnum> GetEnabledChains() => GetAllChains().Where(IsChainEnabled);
        public IEnumerable<ChainEnum> GetAllChains()
        {
            var configuredChains = _configuration.Chains.Keys
                .Where(key => Enum.TryParse<ChainEnum>(key, out _))
                .Select(key => Enum.Parse<ChainEnum>(key));
            var enumChains = Enum.GetValues<ChainEnum>();
            return configuredChains.Union(enumChains).Distinct();
        }
        public bool IsChainEnabled(ChainEnum chain) => GetChainConfig(chain)?.IsEnabled ?? false;

        public string? GetRpcUrl(ChainEnum chain, string? alchemyApiKey = null)
        {
            var config = GetChainConfig(chain);
            if (config?.Rpc == null) return null;
            if (!string.IsNullOrEmpty(config.Rpc.Primary)) return config.Rpc.Primary;
            if (!string.IsNullOrEmpty(alchemyApiKey) && !string.IsNullOrEmpty(config.Rpc.Alchemy))
                return config.Rpc.Alchemy.Replace("{API_KEY}", alchemyApiKey);
            return config.Rpc.Fallbacks.FirstOrDefault();
        }

        public T? GetProtocolConfig<T>(ChainEnum chain) where T : class
        {
            var config = GetChainConfig(chain);
            if (config?.Protocols == null) return null;
            return typeof(T).Name switch
            {
                nameof(UniswapV3Config) => config.Protocols.UniswapV3 as T,
                nameof(AaveConfig) => config.Protocols.Aave as T,
                nameof(MoralisConfig) => config.Protocols.Moralis as T,
                _ => null
            };
        }

        public UniswapV3Config? GetUniswapV3Config(ChainEnum chain) => GetProtocolConfig<UniswapV3Config>(chain);
        public AaveConfig? GetAaveConfig(ChainEnum chain) => GetProtocolConfig<AaveConfig>(chain);
        public MoralisConfig? GetMoralisConfig(ChainEnum chain) => GetProtocolConfig<MoralisConfig>(chain);

        // New helpers to replace ChainExtensions
        public string GetChainSlug(ChainEnum chain)
        {
            var cfg = GetChainConfig(chain);
            if (!string.IsNullOrWhiteSpace(cfg?.Slug)) return cfg.Slug!;
            // fallback convert enum name to lowercase (ethereum, base, arbitrum, etc.)
            return chain.ToString().ToLowerInvariant();
        }

        public int GetNumericChainId(ChainEnum chain)
        {
            var cfg = GetChainConfig(chain);
            return cfg?.ChainId > 0 ? cfg.ChainId : 0;
        }

        public string GetDisplayName(ChainEnum chain)
        {
            var cfg = GetChainConfig(chain);
            return string.IsNullOrWhiteSpace(cfg?.DisplayName) ? chain.ToString() : cfg!.DisplayName;
        }

        public string? GetIconUrl(ChainEnum chain)
        {
            var cfg = GetChainConfig(chain);
            return string.IsNullOrWhiteSpace(cfg?.IconUrl) ? null : cfg!.IconUrl;
        }

        public ChainValidationResult ValidateChainConfig(ChainEnum chain)
        {
            var result = new ChainValidationResult { IsValid = true };
            var config = GetChainConfig(chain);
            if (config == null)
            {
                result.IsValid = false;
                result.Errors.Add($"No configuration found for chain {chain}");
                return result;
            }
            if (string.IsNullOrEmpty(config.DisplayName)) result.Warnings.Add($"Chain {chain} has no display name");
            if (config.ChainId <= 0) result.Warnings.Add($"Chain {chain} has invalid chain ID: {config.ChainId}");
            if (config.Rpc == null || (string.IsNullOrEmpty(config.Rpc.Primary) && config.Rpc.Fallbacks.Count == 0))
            { result.IsValid = false; result.Errors.Add($"Chain {chain} has no RPC endpoints configured"); }
            if (config.Protocols.UniswapV3?.IsEnabled == true)
            {
                var uni = config.Protocols.UniswapV3;
                if (string.IsNullOrEmpty(uni.Factory)) result.Errors.Add($"Chain {chain} Uniswap V3 factory address is missing");
                if (string.IsNullOrEmpty(uni.PositionManager)) result.Errors.Add($"Chain {chain} Uniswap V3 position manager address is missing");
            }
            if (config.Protocols.Aave?.IsEnabled == true)
            {
                var aave = config.Protocols.Aave;
                if (string.IsNullOrEmpty(aave.PoolAddressesProvider)) result.Warnings.Add($"Chain {chain} Aave pool addresses provider is missing");
            }
            if (result.Errors.Count > 0) result.IsValid = false;
            _logger.LogDebug("Chain {Chain} validation result: Valid={IsValid}, Errors={ErrorCount}, Warnings={WarningCount}", chain, result.IsValid, result.Errors.Count, result.Warnings.Count);
            return result;
        }
    }
}