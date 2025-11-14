using MyWebWallet.API.Models;
using MyWebWallet.API.Plugins;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using System.Diagnostics;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation; // added for ITokenFactory

namespace MyWebWallet.API.Plugins.Protocols
{
    [ProtocolPlugin("uniswap-v3", "Uniswap V3", "1.0.0")]
    public class UniswapV3Plugin : IDeFiProtocolPlugin
    {
        private readonly IUniswapV3OnChainService _uniswapV3Service;
        private readonly IChainConfigurationService _chainConfig;
        private readonly ILogger<UniswapV3Plugin> _logger;
        private readonly ILoggerFactory _loggerFactory;
        private readonly IServiceProvider _serviceProvider;

        public string ProtocolId => "uniswap-v3";
        public string GetProtocolName() => "Uniswap V3";
        public string Version => "1.0.0";
        public string Description => "Uniswap V3 decentralized exchange protocol with concentrated liquidity positions";
        public string WebsiteUrl => "https://app.uniswap.org";
        public string LogoUrl => "https://cdn.moralis.io/defi/uniswap.png";

        public IEnumerable<WalletItemType> SupportedPositionTypes => new[] { WalletItemType.LiquidityPool };

        public UniswapV3Plugin(
            IUniswapV3OnChainService uniswapV3Service,
            IChainConfigurationService chainConfig,
            ILogger<UniswapV3Plugin> logger,
            ILoggerFactory loggerFactory,
            IServiceProvider serviceProvider)
        {
            _uniswapV3Service = uniswapV3Service;
            _chainConfig = chainConfig;
            _logger = logger;
            _loggerFactory = loggerFactory;
            _serviceProvider = serviceProvider;
        }

        public Task InitializeAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
        { _logger.LogInformation("Initializing Uniswap V3 plugin"); return Task.CompletedTask; }

        public bool SupportsChain(ChainEnum chain) => _chainConfig.GetUniswapV3Config(chain)?.IsEnabled == true;
        public IEnumerable<ChainEnum> GetSupportedChains() => _chainConfig.GetEnabledChains().Where(SupportsChain);

        public async Task<ValidationResult> ValidateConfigurationAsync(ChainEnum chain, CancellationToken cancellationToken = default)
        {
            var result = new ValidationResult { IsValid = true };
            try
            {
                var config = _chainConfig.GetUniswapV3Config(chain);
                if (config == null) { result.IsValid = false; result.Errors.Add($"No Uniswap V3 configuration found for chain {chain}"); return result; }
                if (!config.IsEnabled) { result.IsValid = false; result.Errors.Add($"Uniswap V3 is disabled for chain {chain}"); return result; }
                if (string.IsNullOrEmpty(config.Factory)) result.Errors.Add($"Factory address is missing for chain {chain}");
                if (string.IsNullOrEmpty(config.PositionManager)) result.Errors.Add($"Position Manager address is missing for chain {chain}");
                var chainValidation = _chainConfig.ValidateChainConfig(chain); if (!chainValidation.IsValid) result.Errors.AddRange(chainValidation.Errors);
                result.IsValid = result.Errors.Count == 0;
            }
            catch (Exception ex) { _logger.LogError(ex, "Error validating Uniswap V3 configuration for chain {Chain}", chain); result.IsValid = false; result.Errors.Add($"Configuration validation error: {ex.Message}"); }
            return result;
        }

        private Services.Mappers.UniswapV3Mapper CreateMapper()
        {
            var mapperLogger = _loggerFactory.CreateLogger<Services.Mappers.UniswapV3Mapper>();
            var tokenFactory = _serviceProvider.GetRequiredService<ITokenFactory>();
            var protocolConfig = _serviceProvider.GetRequiredService<IProtocolConfigurationService>();
            var chainConfig = _serviceProvider.GetRequiredService<IChainConfigurationService>();
            return new Services.Mappers.UniswapV3Mapper(_uniswapV3Service, mapperLogger, tokenFactory, protocolConfig, chainConfig);
        }

        public async Task<List<WalletItem>> GetWalletItemsAsync(string accountAddress, ChainEnum chain, CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogDebug("Getting Uniswap V3 positions for account {Account} on chain {Chain}", accountAddress, chain);

                var response = await _uniswapV3Service.GetActivePoolsOnChainAsync(accountAddress, true, chain);
                
                if (response?.Data?.Positions == null || response.Data.Positions.Count == 0)
                {
                    _logger.LogDebug("No Uniswap V3 positions found for account {Account} on chain {Chain}", accountAddress, chain);
                    return new List<WalletItem>();
                }

                var mapper = CreateMapper();
                var walletItems = await mapper.MapAsync(response, chain);
                
                _logger.LogInformation("Found {Count} Uniswap V3 positions for account {Account} on chain {Chain}", 
                    walletItems.Count, accountAddress, chain);

                return walletItems;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Uniswap V3 wallet items for account {Account} on chain {Chain}", accountAddress, chain);
                throw;
            }
        }

        public async Task<WalletItem?> GetPositionAsync(string positionId, ChainEnum chain, CancellationToken cancellationToken = default)
        {
            try
            {
                if (!System.Numerics.BigInteger.TryParse(positionId, out var tokenId))
                {
                    _logger.LogWarning("Invalid position ID format: {PositionId}", positionId);
                    return null;
                }

                var response = await _uniswapV3Service.GetActivePoolsOnChainAsync(new[] { tokenId }, false);
                
                if (response?.Data?.Positions?.FirstOrDefault() == null)
                {
                    return null;
                }

                var mapper = CreateMapper();
                var walletItems = await mapper.MapAsync(response, chain);
                return walletItems.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Uniswap V3 position {PositionId} on chain {Chain}", positionId, chain);
                return null;
            }
        }

        public Task<object?> GetHistoricalDataAsync(string accountAddress, ChainEnum chain, DateTime? fromDate = null, CancellationToken cancellationToken = default)
            => Task.FromResult<object?>(null);

        public async Task<HealthCheckResult> CheckHealthAsync(ChainEnum? chain = null, CancellationToken cancellationToken = default)
        {
            var stopwatch = Stopwatch.StartNew();
            try
            {
                var chainsToCheck = chain.HasValue ? new[] { chain.Value } : GetSupportedChains();
                var allHealthy = true; var errors = new List<string>();
                foreach (var chainToCheck in chainsToCheck)
                { var validation = await ValidateConfigurationAsync(chainToCheck, cancellationToken); if (!validation.IsValid) { allHealthy = false; errors.AddRange(validation.Errors); } }
                stopwatch.Stop();
                return allHealthy ? HealthCheckResult.Healthy(stopwatch.Elapsed, "All configurations valid") : HealthCheckResult.Unhealthy("Configuration validation failed", errors);
            }
            catch (Exception ex)
            { stopwatch.Stop(); _logger.LogError(ex, "Health check failed for Uniswap V3 plugin"); return HealthCheckResult.Unhealthy("Health check exception", new[] { ex.Message }); }
        }
    }
}