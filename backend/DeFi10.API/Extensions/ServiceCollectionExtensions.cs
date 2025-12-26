using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure;
using DeFi10.API.Infrastructure.MongoDB;
using DeFi10.API.Infrastructure.Redis;
using DeFi10.API.Messaging.Rabbit;
using DeFi10.API.Messaging.Workers;
using DeFi10.API.Messaging.Workers.TriggerRules;
using DeFi10.API.Repositories;
using DeFi10.API.Services.Core;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Domain;
using DeFi10.API.Services.Protocols.Aave;
using DeFi10.API.Services.Protocols.Uniswap;
using DeFi10.API.Services.Protocols.Pendle;
using DeFi10.API.Services.Protocols.Kamino;
using DeFi10.API.Services.Infrastructure.MoralisSolana;
using DeFi10.API.Services.Protocols.Raydium;
using DeFi10.API.Services.Infrastructure.Moralis;
using DeFi10.API.Services.Infrastructure.Alchemy;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using DeFi10.API.Services.Infrastructure;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.Moralis.Models;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using DeFi10.API.Services.Protocols.Pendle.Models;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using Microsoft.Extensions.Options;
using Solnet.Rpc;
using StackExchange.Redis;
using DeFi10.API.Services.Protocols.Aave.Mappers;
using DeFi10.API.Services.Protocols.Pendle.Mappers;
using DeFi10.API.Services.Protocols.Uniswap.Mappers;
using DeFi10.API.Services.Infrastructure.Moralis.Mappers;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Kamino.Mappers;
using DeFi10.API.Services.Protocols.Raydium.Mappers;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Mappers;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;
using DeFi10.API.Services.HostedServices;
using DeFi10.API.Repositories.Interfaces;
using DeFi10.API.Services.Events;

namespace DeFi10.API.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationOptions(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<CoinMarketCapOptions>(configuration.GetSection("CoinMarketCap"));
        services.Configure<RedisOptions>(configuration.GetSection("Redis"));
        services.Configure<MongoDBOptions>(configuration.GetSection("MongoDB"));
        services.Configure<AggregationOptions>(configuration.GetSection("Aggregation"));
        services.Configure<UniswapV3WorkerOptions>(configuration.GetSection("UniswapV3Workers"));
        services.Configure<ProtocolConfigurationOptions>(configuration.GetSection("ProtocolConfiguration"));
        services.Configure<ChainConfiguration>(configuration.GetSection("ChainConfiguration"));
        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMQ"));
        services.Configure<MoralisOptions>(configuration.GetSection("Moralis"));
        services.Configure<AaveOptions>(configuration.GetSection("Aave"));
        services.Configure<PendleOptions>(configuration.GetSection("Pendle"));
        services.Configure<KaminoOptions>(configuration.GetSection("Kamino"));
        services.Configure<SolanaOptions>(configuration.GetSection("Solana"));
        services.Configure<AlchemyOptions>(configuration.GetSection("Alchemy"));
        services.Configure<ProofOfWorkOptions>(configuration.GetSection("ProofOfWork"));
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));

        // PostConfigure to inject AlchemyOptions into SolanaOptions for URL construction
        services.PostConfigure<SolanaOptions>((solanaOpts) =>
        {
            var alchemyOpts = configuration.GetSection("Alchemy").Get<AlchemyOptions>();
            if (alchemyOpts != null)
            {
                solanaOpts.AlchemyOptions = alchemyOpts;
            }
        });

        return services;
    }

    public static IServiceCollection AddOptionsValidation(this IServiceCollection services)
    {
        services.AddSingleton<IValidateOptions<MoralisOptions>, MoralisOptions>();
        services.AddSingleton<IValidateOptions<RedisOptions>, RedisOptions>();
        services.AddSingleton<IValidateOptions<MongoDBOptions>, MongoDBOptions>();
        services.AddSingleton<IValidateOptions<AggregationOptions>, AggregationOptions>();
        services.AddSingleton<IValidateOptions<AaveOptions>, AaveOptions>();
        services.AddSingleton<IValidateOptions<SolanaOptions>, SolanaOptions>();
        services.AddSingleton<IValidateOptions<AlchemyOptions>, AlchemyOptions>();
        services.AddSingleton<IValidateOptions<ProofOfWorkOptions>, ProofOfWorkOptions>();
        services.AddSingleton<IValidateOptions<JwtOptions>, JwtOptions>();

        return services;
    }

    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
    {
        services.AddSingleton<ISystemClock, SystemClock>();
        services.AddSingleton<IRedisDatabase, RedisDatabaseWrapper>();
        services.AddSingleton<IMongoDBContext, MongoDBContext>();
        services.AddScoped<IWalletGroupRepository, WalletGroupRepository>();
        services.AddScoped<IStrategyRepository, StrategyRepository>();
        services.AddScoped<ITokenMetadataRepository, TokenMetadataRepository>();

        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var cfg = sp.GetRequiredService<IConfiguration>();
            var optCfg = sp.GetRequiredService<IOptions<RedisOptions>>().Value;
            var cs = optCfg.ConnectionString ?? cfg["Redis:ConnectionString"];
            if (string.IsNullOrEmpty(cs)) throw new InvalidOperationException("Redis connection string is required");
            var opt = ConfigurationOptions.Parse(cs);
            if (!string.IsNullOrEmpty(optCfg.User)) opt.User = optCfg.User;
            if (!string.IsNullOrEmpty(optCfg.Password)) opt.Password = optCfg.Password;
            opt.AbortOnConnectFail = false; 
            opt.ConnectRetry = optCfg.ConnectRetry; 
            opt.ConnectTimeout = optCfg.ConnectTimeoutMs; 
            opt.SyncTimeout = optCfg.SyncTimeoutMs;
            return ConnectionMultiplexer.Connect(opt);
        });

        services.AddScoped<ICacheService, RedisCacheService>();
        services.AddSingleton<IRpcClientFactory, RpcClientFactory>();

        return services;
    }

    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddSingleton<IChainConfigurationService, ChainConfigurationService>();
        services.AddSingleton<IProtocolConfigurationService, ProtocolConfigurationService>();
        services.AddScoped<IWalletGroupService, WalletGroupService>();
        services.AddSingleton<IProofOfWorkService, ProofOfWorkService>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IWalletAggregationService, WalletAggregationService>();
        services.AddScoped<IStrategyService, StrategyService>();
        services.AddScoped<IProtocolStatusService, ProtocolStatusService>();

        return services;
    }

    public static IServiceCollection AddProtocolServices(this IServiceCollection services)
    {
        services.AddScoped<IMoralisEVMService, MoralisEVMService>();
        services.AddScoped<IAaveeService, AaveeService>();
        services.AddScoped<IUniswapV3Service, UniswapV3Service>();
        services.AddSingleton<IUniswapV3OnChainService, UniswapV3OnChainService>();
        services.AddScoped<IAlchemyNftService, AlchemyNftService>();
        services.AddScoped<IPendleService, PendleService>();
        services.AddScoped<IKaminioService, KaminoService>();
        services.AddScoped<IMoralisSolanaService, MoralisSolanaService>();
        services.AddScoped<IRaydiumOnChainService, RaydiumOnChainService>();
        services.AddScoped<ITokenMetadataService, TokenMetadataService>();
        services.AddScoped<TokenHydrationHelper>();
        services.AddScoped<WalletItemLabelEnricher>();

        services.AddHttpClient<KaminoService>();
        services.AddHttpClient<MoralisSolanaService>();
        services.AddHttpClient<WalletAggregationService>();
        services.AddHttpClient<MoralisEVMService>();
        services.AddHttpClient<ICoinMarketCapService, CoinMarketCapService>();
        services.AddHttpClient<PendleService>();
        services.AddHttpClient<UniswapV3OnChainService>();
        services.AddHttpClient<RaydiumOnChainService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(60); // Increased timeout for Raydium RPC operations
        });

        return services;
    }

    public static IServiceCollection AddMappers(this IServiceCollection services)
    {
        services.AddScoped<IWalletItemMapper<IEnumerable<TokenDetail>>, MoralisTokenMapper>();
        services.AddScoped<IWalletItemMapper<AaveGetUserSuppliesResponse>, AaveSuppliesMapper>();
        services.AddScoped<IWalletItemMapper<AaveGetUserBorrowsResponse>, AaveBorrowsMapper>();
        services.AddScoped<IWalletItemMapper<UniswapV3GetActivePoolsResponse>, UniswapV3Mapper>();
        services.AddScoped<IWalletItemMapper<PendleVePositionsResponse>, PendleVeMapper>();
        services.AddScoped<IWalletItemMapper<PendleDepositsResponse>, PendleDepositsMapper>();
        services.AddScoped<IWalletItemMapper<SolanaTokenResponse>, MoralisSolanaMapper>();
        services.AddScoped<IWalletItemMapper<IEnumerable<KaminoPosition>>, KaminoMapper>();
        services.AddScoped<IWalletItemMapper<IEnumerable<RaydiumPosition>>, RaydiumMapper>();
        services.AddScoped<IWalletItemMapperFactory, WalletItemMapperFactory>();

        return services;
    }

    public static IServiceCollection AddAggregationServices(this IServiceCollection services)
    {
        services.AddSingleton<IAggregationJobStore, AggregationJobStore>();
        services.AddSingleton<ITokenFactory, TokenFactory>();
        services.AddScoped<IPriceService, PriceService>();
        services.AddSingleton<IProjectionCalculator, ProjectionCalculator>();

        return services;
    }

    public static IServiceCollection AddMessaging(this IServiceCollection services)
    {
        services.AddSingleton<IRabbitMqConnectionFactory, RabbitMqConnectionFactory>();
        services.AddSingleton<IMessagePublisher, RabbitMqPublisher>();

        // Dynamic Job Expansion Services (for event-driven protocol triggering)
        services.AddSingleton<JobExpansionService>();
        services.AddSingleton<IProtocolTriggerDetector, UniswapV3NftDetector>();
        services.AddSingleton<IProtocolTriggerDetector, RaydiumNftDetector>();

        // Token price update publisher for TokenMetadataService batch events
        services.AddScoped<ITokenPriceUpdatePublisher, TokenPriceUpdatePublisher>();

        services.AddHostedService<IntegrationRequestWorker>();
        services.AddHostedService<IntegrationResultAggregatorWorker>();
        services.AddHostedService<WalletConsolidationWorker>();
        services.AddHostedService<AggregationTimeoutMonitorWorker>();

        // Token Metadata Cache Warmup Service (loads token metadata on startup)
        services.AddHostedService<TokenMetadataCacheWarmupService>();

        return services;
    }
}
