using MyWebWallet.API.Messaging;
using MyWebWallet.API.Messaging.Contracts;
using MyWebWallet.API.Messaging.Rabbit;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;
using Microsoft.Extensions.Logging;
using System.Linq;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Plugins.Protocols
{
    public class SolanaTokensPlugin : IProtocolPlugin
    {
        private readonly IMessagePublisher _publisher;
        private readonly IMoralisSolanaService _solanaService;
        private readonly ILogger<SolanaTokensPlugin> _logger;

        public SolanaTokensPlugin(IMessagePublisher publisher, IMoralisSolanaService solanaService, ILogger<SolanaTokensPlugin> logger)
        {
            _publisher = publisher;
            _solanaService = solanaService;
            _logger = logger;
        }

        public string ProtocolId => "solana-tokens";
        public string Version => "1.0";
        public string Description => "Fetches Solana native and SPL token balances using Moralis.";
        public string WebsiteUrl => "https://moralis.io";
        public string LogoUrl => "https://moralis.io/wp-content/uploads/2023/11/Moralis-Favicon-Purple.svg";

        public IntegrationProvider Provider => IntegrationProvider.SolanaTokens;

        public bool SupportsChain(ChainEnum chain) => _solanaService.SupportsChain(chain);
        public IEnumerable<ChainEnum> GetSupportedChains() => _solanaService.GetSupportedChains();

        public Task InitializeAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
        {
            // No initialization required
            return Task.CompletedTask;
        }

        public Task<ValidationResult> ValidateConfigurationAsync(ChainEnum chain, CancellationToken cancellationToken = default)
        {
            // No specific configuration to validate
            return Task.FromResult(new ValidationResult { IsValid = true });
        }

        public async Task<List<WalletItem>> GetWalletItemsAsync(string accountAddress, ChainEnum chain, CancellationToken cancellationToken = default)
        {
            // This plugin uses a message-based approach, so this method is not directly used for data fetching.
            // It could be implemented to provide a direct, synchronous-like call if needed in the future.
            _logger.LogInformation("GetWalletItemsAsync called for SolanaTokensPlugin, but it operates via messaging. Returning empty list.");
            return await Task.FromResult(new List<WalletItem>());
        }

        public async Task<HealthCheckResult> CheckHealthAsync(ChainEnum? chain = null, CancellationToken cancellationToken = default)
        {
            try
            {
                // Check a well-known address to see if the service is responsive
                var testAddress = "So11111111111111111111111111111111111111112";
                await _solanaService.GetTokensAsync(testAddress, ChainEnum.Solana);
                return HealthCheckResult.Healthy(TimeSpan.Zero);
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy(ex.Message, new[] { ex.Message });
            }
        }

        public async Task FetchData(string walletAddress, ChainEnum chain, string jobId)
        {
            if (!SupportsChain(chain))
            {
                _logger.LogWarning("{Provider} does not support chain {Chain}", ProtocolId, chain);
                return;
            }

            try
            {
                var tokens = await _solanaService.GetTokensAsync(walletAddress, chain);
                var result = new IntegrationResult(
                    Guid.Parse(jobId),
                    Guid.NewGuid(),
                    walletAddress,
                    new[] { chain.ToString() },
                    Provider,
                    IntegrationStatus.Success,
                    DateTime.UtcNow,
                    DateTime.UtcNow,
                    null,
                    null,
                    tokens
                );
                await _publisher.PublishAsync($"integration.result.{Provider.ToString().ToLower()}", result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching Solana tokens for address {Address}", walletAddress);
                var result = new IntegrationResult(
                    Guid.Parse(jobId),
                    Guid.NewGuid(),
                    walletAddress,
                    new[] { chain.ToString() },
                    Provider,
                    IntegrationStatus.Failed,
                    DateTime.UtcNow,
                    DateTime.UtcNow,
                    ex.Message,
                    ex.StackTrace,
                    null
                );
                await _publisher.PublishAsync($"integration.result.{Provider.ToString().ToLower()}", result);
            }
        }
    }
}
