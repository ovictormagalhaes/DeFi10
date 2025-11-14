using Microsoft.Extensions.Options;
using MyWebWallet.API.Messaging.Contracts;
using MyWebWallet.API.Messaging.Rabbit;
using RabbitMQ.Client;
using System.Text.Json;
using System.Text.Json.Serialization;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Messaging.Extensions;
using System.Numerics;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Messaging.Workers;

// Worker that consumes IntegrationRequest messages and performs real provider calls, publishing IntegrationResult
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

    private static readonly Dictionary<int, TimeSpan> RetryDelays = new()
    {
        {1, TimeSpan.FromSeconds(5)}, // after first failed attempt
        {2, TimeSpan.FromSeconds(10)} // after second failed attempt
    }; // third failure => publish final failed result (no retry)

    protected override string QueueName => "integration.requests"; // generic queue; could later split per provider

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
        channel.QueueBind(QueueName, exchange: Options.Exchange, routingKey: "integration.request.*");
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
        _logger.LogInformation("Processing IntegrationRequest JobId={JobId} Provider={Provider} Attempt={Attempt} Chains={Chains}", 
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
                    var svc = scope.ServiceProvider.GetRequiredService<IMoralisService>();
                    payload = await svc.GetERC20TokenBalanceAsync(request.Account, chainEnum.ToChainId());
                    status = IntegrationStatus.Success; break;
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
                    // Processamento granular resiliente para UniswapV3
                    if (_uniswapV3Options.EnableGranularProcessing)
                    {
                        // Option 1: enumerate ids, then delegate to service detailed builder for accurate fees and pricing
                        var uniSvc = scope.ServiceProvider.GetRequiredService<IUniswapV3OnChainService>();
                        var ids = await uniSvc.EnumeratePositionIdsAsync(request.Account, chainEnum, onlyOpen: true);
                        if (ids != null && ids.Any())
                        {
                            payload = await uniSvc.GetActivePoolsOnChainAsync(ids, chainEnum, onlyOpenPositions: true);
                            status = IntegrationStatus.Success;
                        }
                        else
                        {
                            // no positions -> success with empty response
                            payload = await uniSvc.GetActivePoolsOnChainAsync(Array.Empty<BigInteger>(), chainEnum, onlyOpenPositions: true);
                            status = IntegrationStatus.Success;
                        }
                    }
                    else
                    {
                        // Fallback para processamento tradicional
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
                case IntegrationProvider.SolanaKaminoPositions:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<ISolanaService>();
                    payload = await svc.GetKaminoPositionsAsync(request.Account, chainEnum);
                    status = IntegrationStatus.Success; break;
                }
                // MANTÉM RAYDIUM DESATIVADO POR ENQUANTO
                /*
                case IntegrationProvider.SolanaRaydiumPositions:
                {
                    var svc = scope.ServiceProvider.GetRequiredService<ISolanaService>();
                    payload = await svc.GetRaydiumPositionsAsync(request.Account, chainEnum);
                    status = IntegrationStatus.Success; break;
                }
                */
                default:
                    status = IntegrationStatus.Failed;
                    errorCode = "NOT_IMPLEMENTED";
                    errorMessage = $"Provider {request.Provider} not implemented yet";
                    break;
            }
        }
        catch (OperationCanceledException)
        {
            status = IntegrationStatus.Cancelled;
            errorCode = "CANCELLED";
            errorMessage = "Operation cancelled";
        }
        catch (Exception ex)
        {
            status = IntegrationStatus.Failed;
            errorCode = ex.GetType().Name;
            errorMessage = ex.Message;
            _logger.LogError(ex, "Error processing IntegrationRequest JobId={JobId} Provider={Provider} Attempt={Attempt}", 
                request.JobId, request.Provider, request.Attempt);
        }

        var finished = DateTime.UtcNow;

        // Retry policy: if failed/cancelled/timedout and attempts remain, schedule retry instead of publishing result
        if (status != IntegrationStatus.Success && request.Attempt < 3)
        {
            var nextAttempt = request.Attempt + 1;
            var delay = RetryDelays.ContainsKey(request.Attempt) ? RetryDelays[request.Attempt] : TimeSpan.FromSeconds(30);
            _logger.LogWarning("Scheduling retry Attempt={NextAttempt} in {Delay}s JobId={JobId} Provider={Provider}", 
                nextAttempt, delay.TotalSeconds, request.JobId, request.Provider);
            
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
                    var rk = $"integration.request.{ProviderSlug(request.Provider)}";
                    await _publisher.PublishAsync(rk, retryReq);
                    _logger.LogInformation("Retry published Attempt={Attempt} JobId={JobId} Provider={Provider}", 
                        nextAttempt, request.JobId, request.Provider);
                }
                catch (Exception rex)
                {
                    _logger.LogError(rex, "Failed publishing retry Attempt={Attempt} JobId={JobId} Provider={Provider}", 
                        nextAttempt, request.JobId, request.Provider);
                }
            });
            return; // do not publish intermediate failed result
        }

        // Publish only on success or final failed attempt
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
            _logger.LogInformation("Publishing IntegrationResult JobId={JobId} Provider={Provider} Status={Status} Attempt={Attempt}", 
                request.JobId, request.Provider, status, request.Attempt);

            await _publisher.PublishAsync($"integration.result.{request.Provider.ToString().ToLowerInvariant()}", result, ct);
        }
        catch (TimeoutException tex)
        {
            _logger.LogError(tex, "Timeout publishing result JobId={JobId} Provider={Provider} Attempt={Attempt} - this may cause aggregation delays", 
                request.JobId, request.Provider, request.Attempt);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing result JobId={JobId} Provider={Provider} Attempt={Attempt}", 
                request.JobId, request.Provider, request.Attempt);
            throw;
        }
    }

    private static string ProviderSlug(IntegrationProvider provider) => provider.ToString().ToLowerInvariant();
}
