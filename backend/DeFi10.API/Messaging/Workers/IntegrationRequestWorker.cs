using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Requests;
using DeFi10.API.Messaging.Contracts.Results;
using DeFi10.API.Messaging.Rabbit;
using DeFi10.API.Messaging.Constants;
using RabbitMQ.Client;
using System.Text.Json;
using System.Text.Json.Serialization;
using DeFi10.API.Models;
using DeFi10.API.Services.Infrastructure.MoralisSolana;
using DeFi10.API.Services.Protocols.Raydium;
using DeFi10.API.Services.Protocols.Aave;
using DeFi10.API.Services.Protocols.Uniswap;
using DeFi10.API.Services.Protocols.Pendle;
using DeFi10.API.Services.Infrastructure.Moralis;
using DeFi10.API.Services.Infrastructure.Moralis.Models;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using System.Numerics;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Protocols.Kamino;

namespace DeFi10.API.Messaging.Workers;

public class IntegrationRequestWorker : BaseConsumer
{
    private readonly ILogger<IntegrationRequestWorker> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
    private readonly IMessagePublisher _publisher;
    private readonly IServiceProvider _serviceProvider;
    private readonly UniswapV3WorkerOptions _uniswapV3Options;

    // Exponential backoff delays
    private static readonly Dictionary<int, TimeSpan> RetryDelays = new()
    {
        {1, TimeSpan.FromSeconds(5)},
        {2, TimeSpan.FromSeconds(15)},  // Aumentado de 10s
        {3, TimeSpan.FromSeconds(45)}   // Nova tentativa com delay maior
    };

    protected override string QueueName => "integration.requests";

    public IntegrationRequestWorker(
        IRabbitMqConnectionFactory connectionFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<IntegrationRequestWorker> logger,
        IMessagePublisher publisher,
        IServiceProvider serviceProvider,
        IOptions<UniswapV3WorkerOptions> uniswapV3Options)
        : base(connectionFactory, options, logger)
    {
        _logger = logger;
        _publisher = publisher;
        _serviceProvider = serviceProvider;
        _uniswapV3Options = uniswapV3Options.Value;
    }

    protected override void DeclareQueues(IModel channel)
    {
        channel.QueueDeclare(QueueName, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(QueueName, exchange: Options.Exchange, routingKey: RoutingKeys.IntegrationRequestPattern);
    }

    private static bool ShouldRetry(IntegrationStatus status, string? errorCode)
    {
        if (status == IntegrationStatus.Success) 
            return false;
        
        if (status == IntegrationStatus.Cancelled) 
            return false;
        
        if (errorCode is "NOT_IMPLEMENTED" or "UNAUTHORIZED" or "FORBIDDEN" or "INVALID_REQUEST")
            return false;
        
        return true;
    }

    protected override async Task HandleMessageAsync(string routingKey, ReadOnlyMemory<byte> body, IBasicProperties props, CancellationToken ct)
    {
        var request = JsonSerializer.Deserialize<IntegrationRequest>(body.Span, _jsonOptions);
        if (request is null)
        {
            _logger.LogWarning("Received null IntegrationRequest payload");
            return;
        }

        var started = DateTime.UtcNow;
        _logger.LogDebug("Processing IntegrationRequest JobId={JobId} Provider={Provider} Attempt={Attempt} Chains={Chains}", 
            request.JobId, request.Provider, request.Attempt, string.Join(',', request.Chains));

        IntegrationStatus status;
        object? payload = null;
        string? errorCode = null;
        string? errorMessage = null;

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var chainStr = request.Chains.FirstOrDefault();
            Enum.TryParse<ChainEnum>(chainStr, true, out var chainEnum);

            switch (request.Provider)
            {
                case IntegrationProvider.MoralisTokens:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IMoralisEVMService>();
                    payload = await svc.GetERC20TokenBalanceAsync(request.Account, chainEnum.ToChainId());
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.MoralisNfts:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IMoralisEVMService>();
                    _logger.LogDebug("MoralisNfts: Fetching NFTs for account {Account} chain {Chain}", 
                        request.Account, chainEnum);
                    
                    try
                    {
                        payload = await svc.GetNFTsAsync(request.Account, chainEnum.ToChainId());
                        status = IntegrationStatus.Success;
                        
                        if (payload is MoralisGetNFTsResponse nftResponse)
                        {
                            _logger.LogDebug("MoralisNfts: Successfully fetched {Count} NFTs for account {Account} chain {Chain}", 
                                nftResponse.Result.Count, request.Account, chainEnum);
                            
                            // Log detailed info about each NFT for debugging
                            _logger.LogDebug("=== MoralisNfts: Detailed NFT List for {Chain} ===", chainEnum);
                            for (int i = 0; i < Math.Min(nftResponse.Result.Count, 50); i++) // Log first 50 NFTs
                            {
                                var nft = nftResponse.Result[i];
                                var contractAddr = nft.TokenAddress ?? "unknown";
                                var tokenId = nft.TokenId ?? "unknown";
                                var name = nft.Name ?? "unnamed";
                                
                                _logger.LogDebug("MoralisNfts: NFT #{Index} - Contract: {Contract}, TokenId: {TokenId}, Name: {Name}",
                                    i + 1, contractAddr, tokenId, name);
                            }
                            
                            if (nftResponse.Result.Count > 50)
                            {
                                _logger.LogDebug("MoralisNfts: ... and {More} more NFTs (showing first 50 only)",
                                    nftResponse.Result.Count - 50);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "MoralisNfts: Error fetching NFTs for account {Account} chain {Chain}", 
                            request.Account, chainEnum);
                        payload = new MoralisGetNFTsResponse { Result = new List<MoralisNftDetail>() };
                        status = IntegrationStatus.Success; // Return empty list on error
                    }
                    break;
                }
                case IntegrationProvider.AaveSupplies:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IAaveeService>();
                    payload = await svc.GetUserSupplies(request.Account, chainEnum.ToChainId());
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.AaveBorrows:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IAaveeService>();
                    payload = await svc.GetUserBorrows(request.Account, chainEnum.ToChainId());
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.UniswapV3Positions:
                {
                    try
                    {
                        var graphqlSvc = scope.ServiceProvider.GetRequiredService<IUniswapV3Service>();
                        var graphqlResult = await graphqlSvc.GetActivePoolsHybridAsync(request.Account, chainEnum);
                        
                        if (graphqlResult?.Data?.Positions != null && graphqlResult.Data.Positions.Any())
                        {
                            _logger.LogInformation("[Uniswap Phase1] GraphQL found {Count} positions for {Account} - saved ~90% RPC costs", 
                                graphqlResult.Data.Positions.Count, request.Account);
                            payload = graphqlResult;
                            status = IntegrationStatus.Success;
                            break;
                        }
                        else
                        {
                            _logger.LogDebug("[Uniswap Phase1] GraphQL returned no positions for {Account} - trying RPC fallback", request.Account);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[Uniswap Phase1] GraphQL failed for {Account} (Chains={Chains}, Attempt={Attempt}) - falling back to RPC. Exception: {Message}",
                            request.Account, string.Join(',', request.Chains), request.Attempt, ex.Message);
                    }
                    
                    // Fallback to RPC if GraphQL fails or returns empty
                    if (_uniswapV3Options.EnableGranularProcessing)
                    {
                        var uniSvc = scope.ServiceProvider.GetRequiredService<IUniswapV3OnChainService>();
                        var ids = await uniSvc.EnumeratePositionIdsAsync(request.Account, chainEnum, onlyOpen: true);
                        if (ids != null && ids.Any())
                        {
                            payload = await uniSvc.GetActivePoolsOnChainAsync(ids, chainEnum, onlyOpenPositions: true);
                            status = IntegrationStatus.Success;
                        }
                        else
                        {
                            payload = await uniSvc.GetActivePoolsOnChainAsync(Array.Empty<BigInteger>(), chainEnum, onlyOpenPositions: true);
                            status = IntegrationStatus.Success;
                        }
                    }
                    else
                    {
                        var svc = scope.ServiceProvider.GetRequiredService<IUniswapV3OnChainService>();
                        const bool onlyOpen = true;
                        payload = await svc.GetActivePoolsOnChainAsync(request.Account, onlyOpen, chainEnum);
                        status = IntegrationStatus.Success;
                    }
                    break;
                }
                case IntegrationProvider.PendleVePositions:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IPendleService>();
                    payload = await svc.GetVePositionsAsync(request.Account, chainEnum);
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.PendleDeposits:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IPendleService>();
                    payload = await svc.GetDepositsAsync(request.Account, chainEnum);
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.SolanaTokens:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IMoralisSolanaService>();
                    payload = await svc.GetTokensAsync(request.Account, chainEnum);
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.SolanaNfts:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IMoralisSolanaService>();
                    _logger.LogDebug("SolanaNfts: Fetching NFTs for account {Account}", request.Account);
                    
                    try
                    {
                        payload = await svc.GetNFTsAsync(request.Account, chainEnum);
                        status = IntegrationStatus.Success;
                        
                        if (payload is SolanaNFTResponse nftResponse)
                        {
                            _logger.LogDebug("SolanaNfts: Successfully fetched {Count} NFTs for account {Account}", 
                                nftResponse.Nfts.Count, request.Account);
                            
                            // Log detailed info about each NFT for debugging
                            _logger.LogDebug("=== SolanaNfts: Detailed NFT List ===");
                            for (int i = 0; i < Math.Min(nftResponse.Nfts.Count, 50); i++) // Log first 50 NFTs
                            {
                                var nft = nftResponse.Nfts[i];
                                var mint = nft.Mint ?? "unknown";
                                var name = nft.Name ?? "unnamed";
                                var amount = nft.Amount;
                                var decimals = nft.Decimals;
                                
                                _logger.LogDebug("SolanaNfts: NFT #{Index} - Mint: {Mint}, Name: {Name}, Amount: {Amount}, Decimals: {Decimals}",
                                    i + 1, mint, name, amount, decimals);
                            }
                            
                            if (nftResponse.Nfts.Count > 50)
                            {
                                _logger.LogDebug("SolanaNfts: ... and {More} more NFTs (showing first 50 only)",
                                    nftResponse.Nfts.Count - 50);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "SolanaNfts: Error fetching NFTs for account {Account}", request.Account);
                        payload = new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
                        status = IntegrationStatus.Success; // Return empty list on error
                    }
                    break;
                }
                case IntegrationProvider.SolanaKaminoPositions:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IKaminioService>();
                    payload = await svc.GetPositionsAsync(request.Account, chainEnum);
                    status = IntegrationStatus.Success; break;
                }
                case IntegrationProvider.SolanaRaydiumPositions:
                {

                    _logger.LogDebug("[Worker] ========== Processing Raydium CLMM Positions ==========");
                    _logger.LogDebug("[Worker] Account: {Account}, Chain: {Chain}", request.Account, chainEnum);
                    
                    try
                    {
                        var svc = scope.ServiceProvider.GetRequiredService<IRaydiumOnChainService>();
                        _logger.LogDebug("[Worker] RaydiumOnChainService resolved successfully");
                        
                        payload = await svc.GetPositionsAsync(request.Account);

                        if (payload is IEnumerable<RaydiumPosition> positions)
                        {
                            var positionsList = positions.ToList();
                            _logger.LogDebug("[Worker] Raydium returned {Count} positions", positionsList.Count);
                            
                            foreach (var pos in positionsList)
                            {
                                _logger.LogDebug("[Worker] Position: Pool={Pool}, Tokens={TokenCount}, Value={Value:C}", 
                                    pos.Pool, pos.Tokens?.Count ?? 0, pos.TotalValueUsd);
                            }
                            
                            payload = positionsList;
                        }
                        else
                        {
                            _logger.LogWarning("[Worker] Raydium payload is not IEnumerable<RaydiumPosition>: {Type}", 
                                payload?.GetType().FullName ?? "null");
                        }
                        
                        status = IntegrationStatus.Success;
                        _logger.LogDebug("[Worker] Raydium processing completed successfully");
                    }
                    catch (Exception raydiumEx)
                    {
                        _logger.LogError(raydiumEx, "[Worker] Raydium processing failed: {Message}", raydiumEx.Message);
                        throw;
                    }
                    
                    break;
                }
                default:
                    status = IntegrationStatus.Failed;
                    errorCode = "NOT_IMPLEMENTED";
                    errorMessage = $"Provider {request.Provider} not implemented yet";
                    break;
            }
        }
        // Tratamento espec�fico para timeouts de RPC/Network
        catch (Exception ex) when (ex.GetType().Name == "RpcClientTimeoutException")
        {
            status = IntegrationStatus.TimedOut;
            errorCode = "RPC_TIMEOUT";
            errorMessage = $"RPC request timed out: {ex.Message}";
            _logger.LogWarning(ex, "[Worker] RPC timeout for JobId={JobId} Provider={Provider} Attempt={Attempt}", 
                request.JobId, request.Provider, request.Attempt);
        }
        catch (TaskCanceledException tcEx) when (tcEx.CancellationToken.IsCancellationRequested)
        {
            status = IntegrationStatus.Cancelled;
            errorCode = "CANCELLED";
            errorMessage = "Operation was cancelled by user or system";
            _logger.LogWarning("[Worker] Operation cancelled for JobId={JobId} Provider={Provider}", 
                request.JobId, request.Provider);
        }
        catch (TaskCanceledException tcEx)
        {
            status = IntegrationStatus.TimedOut;
            errorCode = "OPERATION_TIMEOUT";
            errorMessage = $"Operation timed out: {tcEx.Message}";
            _logger.LogWarning(tcEx, "[Worker] Operation timeout for JobId={JobId} Provider={Provider} Attempt={Attempt}", 
                request.JobId, request.Provider, request.Attempt);
        }
        catch (HttpRequestException httpEx) when (httpEx.StatusCode.HasValue)
        {
            var statusCodeInt = (int)httpEx.StatusCode.Value;
            
            // Erros permanentes (4xx) - n�o retenta
            if (statusCodeInt >= 400 && statusCodeInt < 500)
            {
                status = IntegrationStatus.Failed;
                errorCode = httpEx.StatusCode.Value switch
                {
                    System.Net.HttpStatusCode.Unauthorized => "UNAUTHORIZED",
                    System.Net.HttpStatusCode.Forbidden => "FORBIDDEN",
                    System.Net.HttpStatusCode.NotFound => "NOT_FOUND",
                    System.Net.HttpStatusCode.BadRequest => "INVALID_REQUEST",
                    _ => $"HTTP_{statusCodeInt}"
                };
                errorMessage = $"HTTP {statusCodeInt}: {httpEx.Message}";
                _logger.LogWarning(httpEx, "[Worker] HTTP {StatusCode} error for JobId={JobId} Provider={Provider}", 
                    statusCodeInt, request.JobId, request.Provider);
            }
            // Erros tempor�rios (5xx) - retenta
            else
            {
                status = IntegrationStatus.Failed;
                errorCode = $"HTTP_{statusCodeInt}";
                errorMessage = $"HTTP {statusCodeInt}: {httpEx.Message}";
                _logger.LogWarning(httpEx, "[Worker] HTTP {StatusCode} error for JobId={JobId} Provider={Provider} (will retry)", 
                    statusCodeInt, request.JobId, request.Provider);
            }
        }
        catch (OperationCanceledException)
        {
            status = IntegrationStatus.Cancelled;
            errorCode = "CANCELLED";
            errorMessage = "Operation cancelled";
            _logger.LogWarning("[Worker] Operation cancelled for JobId={JobId} Provider={Provider}", 
                request.JobId, request.Provider);
        }
        catch (Exception ex)
        {
            status = IntegrationStatus.Failed;
            errorCode = ex.GetType().Name;
            errorMessage = ex.Message;
            _logger.LogError(ex, "[Worker] Error processing IntegrationRequest JobId={JobId} Provider={Provider} Attempt={Attempt}", 
                request.JobId, request.Provider, request.Attempt);
        }

        var finished = DateTime.UtcNow;

        // Retry logic: apenas retenta se for apropriado e n�o excedeu o limite de tentativas
        if (ShouldRetry(status, errorCode) && request.Attempt < 3)
        {
            var nextAttempt = request.Attempt + 1;
            var delay = RetryDelays.ContainsKey(request.Attempt) ? RetryDelays[request.Attempt] : TimeSpan.FromSeconds(60);
            
            _logger.LogWarning("[Worker] Scheduling retry Attempt={NextAttempt}/{MaxAttempts} in {Delay}s JobId={JobId} Provider={Provider} Status={Status} ErrorCode={ErrorCode}", 
                nextAttempt, 3, delay.TotalSeconds, request.JobId, request.Provider, status, errorCode);
            
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(delay, CancellationToken.None);
                    var retryReq = new IntegrationRequest(
                        JobId: request.JobId,
                        RequestId: Guid.NewGuid(),
                        Account: request.Account,
                        Chains: request.Chains,
                        Provider: request.Provider,
                        RequestedAtUtc: DateTime.UtcNow,
                        Attempt: nextAttempt,
                        OperationTimeout: request.OperationTimeout,
                        Metadata: request.Metadata);
                    var rk = RoutingKeys.ForIntegrationRequest(request.Provider);
                    await _publisher.PublishAsync(rk, retryReq);
                    _logger.LogDebug("[Worker] Retry published Attempt={Attempt} JobId={JobId} Provider={Provider}", 
                        nextAttempt, request.JobId, request.Provider);
                }
                catch (Exception rex)
                {
                    _logger.LogError(rex, "[Worker] Failed publishing retry Attempt={Attempt} JobId={JobId} Provider={Provider}", 
                        nextAttempt, request.JobId, request.Provider);
                }
            });
            return;
        }
        else if (!ShouldRetry(status, errorCode))
        {
            _logger.LogDebug("[Worker] Not retrying JobId={JobId} Provider={Provider} Status={Status} ErrorCode={ErrorCode} - error is permanent", 
                request.JobId, request.Provider, status, errorCode);
        }
        else if (request.Attempt >= 3)
        {
            _logger.LogWarning("[Worker] Max retry attempts reached ({MaxAttempts}) for JobId={JobId} Provider={Provider} - giving up", 
                3, request.JobId, request.Provider);
        }

        var result = new IntegrationResult(
            JobId: request.JobId,
            RequestId: request.RequestId,
            Account: request.Account,
            Chains: request.Chains,
            Provider: request.Provider,
            Status: status,
            StartedAtUtc: started,
            FinishedAtUtc: finished,
            ErrorCode: errorCode,
            ErrorMessage: errorMessage,
            Payload: status == IntegrationStatus.Success ? payload : null);

        try
        {
            _logger.LogDebug("[Worker] Publishing IntegrationResult JobId={JobId} Provider={Provider} Status={Status} Attempt={Attempt}", 
                request.JobId, request.Provider, status, request.Attempt);

            await _publisher.PublishAsync(RoutingKeys.ForIntegrationResult(request.Provider), result, ct);
        }
        catch (TimeoutException tex)
        {
            _logger.LogError(tex, "[Worker] Timeout publishing result JobId={JobId} Provider={Provider} Attempt={Attempt} - this may cause aggregation delays", 
                request.JobId, request.Provider, request.Attempt);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Worker] Error publishing result JobId={JobId} Provider={Provider} Attempt={Attempt}", 
                request.JobId, request.Provider, request.Attempt);
            throw;
        }
    }
}