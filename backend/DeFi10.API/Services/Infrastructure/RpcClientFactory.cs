using DeFi10.API.Configuration;
using DeFi10.API.Models;
using Microsoft.Extensions.Options;
using Nethereum.Web3;
using Solnet.Rpc;

namespace DeFi10.API.Services.Infrastructure;

public class RpcClientFactory : IRpcClientFactory
{
    private readonly SolanaOptions _solanaOptions;
    private readonly AlchemyOptions _alchemyOptions;
    private readonly ChainConfiguration _chainConfiguration;
    private readonly ILogger<RpcClientFactory> _logger;
    
    private readonly Lazy<IRpcClient> _solanaClient;

    public RpcClientFactory(
        IOptions<SolanaOptions> solanaOptions,
        IOptions<AlchemyOptions> alchemyOptions,
        IOptions<ChainConfiguration> chainConfiguration,
        ILogger<RpcClientFactory> logger)
    {
        _solanaOptions = solanaOptions.Value;
        _alchemyOptions = alchemyOptions.Value;
        _chainConfiguration = chainConfiguration.Value;
        _logger = logger;
        
        _solanaClient = new Lazy<IRpcClient>(() => 
        {
            var url = _solanaOptions.GetRpcUrl();
            _logger.LogInformation("Creating Solana RPC client: {Url}", url);
            return ClientFactory.GetClient(url);
        });
    }

    public IRpcClient GetSolanaClient() => _solanaClient.Value;

    public IWeb3 GetEvmClient(Chain chain)
    {
        var url = GetRpcUrl(chain);
        _logger.LogDebug("Creating EVM Web3 client for {Chain}: {Url}", chain, url);
        return new Web3(url);
    }

    public string GetRpcUrl(Chain chain)
    {
        if (chain == Chain.Solana)
        {
            return _solanaOptions.GetRpcUrl();
        }

        // 1. Try ChainConfiguration first
        var chainConfig = _chainConfiguration.GetChainConfig(chain);
        if (chainConfig != null)
        {
            if (!string.IsNullOrWhiteSpace(chainConfig.Rpc.Primary))
            {
                _logger.LogDebug("Using Primary RPC for {Chain}: {Url}", chain, chainConfig.Rpc.Primary);
                return chainConfig.Rpc.Primary;
            }
            
            if (!string.IsNullOrWhiteSpace(chainConfig.Rpc.Alchemy))
            {
                _logger.LogDebug("Using Alchemy RPC for {Chain}: {Url}", chain, chainConfig.Rpc.Alchemy);
                return chainConfig.Rpc.Alchemy;
            }
            
            if (chainConfig.Rpc.Fallbacks.Any())
            {
                var fallback = chainConfig.Rpc.Fallbacks.First();
                _logger.LogDebug("Using Fallback RPC for {Chain}: {Url}", chain, fallback);
                return fallback;
            }
        }

        // 2. Fallback to AlchemyOptions
        if (!string.IsNullOrWhiteSpace(_alchemyOptions.ApiKey))
        {
            var url = GetAlchemyUrl(chain);
            _logger.LogDebug("Using Alchemy (from ApiKey) for {Chain}: {Url}", chain, url);
            return url;
        }

        throw new InvalidOperationException($"No RPC URL configured for chain {chain}. Configure ChainConfiguration:Chains:{chain}:Rpc or Alchemy:ApiKey");
    }

    private string GetAlchemyUrl(Chain chain) => chain switch
    {
        Chain.Ethereum => _alchemyOptions.GetEthereumRpcUrl(),
        Chain.Base => _alchemyOptions.GetBaseRpcUrl(),
        Chain.Arbitrum => _alchemyOptions.GetArbitrumRpcUrl(),
        Chain.Solana => _alchemyOptions.GetSolanaRpcUrl(),
        _ => throw new NotSupportedException($"Alchemy does not support chain {chain}")
    };
}
