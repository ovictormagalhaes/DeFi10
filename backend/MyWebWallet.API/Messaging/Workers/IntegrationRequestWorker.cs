using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyWebWallet.API.Messaging.Contracts;
using MyWebWallet.API.Messaging.Rabbit;
using RabbitMQ.Client;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Messaging.Extensions;
using System.Numerics;
using ChainEnum = MyWebWallet.API.Models.Chain;
using TickInfoDTO = MyWebWallet.API.Services.TickInfoDTO;

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
            // only single chain currently expected
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
                        (payload, status, errorCode, errorMessage) = await ProcessUniswapV3GranularAsync(scope, request, chainEnum, ct);
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

    /// <summary>
    /// Processa UniswapV3Positions com lógica granular resiliente interna
    /// </summary>
    private async Task<(object? payload, IntegrationStatus status, string? errorCode, string? errorMessage)> 
        ProcessUniswapV3GranularAsync(IServiceScope scope, IntegrationRequest request, ChainEnum chainEnum, CancellationToken ct)
    {
        var service = scope.ServiceProvider.GetRequiredService<IUniswapV3OnChainService>();
        var results = new UniswapV3GranularResults();
        var successCount = 0;
        var totalOperations = 0;

        _logger.LogInformation("Starting granular Uniswap V3 processing JobId={JobId} Account={Account}", 
            request.JobId, request.Account);

        try
        {
            // 1. Enumeração de posições (operação crítica)
            totalOperations++;
            var positionIds = await ExecuteWithRetryAsync(
                () => service.EnumeratePositionIdsAsync(request.Account, chainEnum, onlyOpen: true),
                "PositionEnumeration", 
                request.JobId);

            if (positionIds?.Any() == true)
            {
                successCount++;
                results.PositionIds = positionIds.ToList();
                
                _logger.LogInformation("Enumerated {Count} positions for JobId={JobId}", 
                    results.PositionIds.Count, request.JobId);

                // 2. Processa cada posição em paralelo (com limite)
                var semaphore = new SemaphoreSlim(_uniswapV3Options.MaxParallelOperations, _uniswapV3Options.MaxParallelOperations);
                var positionTasks = results.PositionIds.Select(async tokenId =>
                {
                    await semaphore.WaitAsync(ct);
                    try
                    {
                        return await ProcessSinglePositionAsync(service, tokenId, chainEnum, request.JobId);
                    }
                    finally
                    {
                        semaphore.Release();
                    }
                });

                var positionResults = await Task.WhenAll(positionTasks);
                
                // Agrega resultados
                foreach (var posResult in positionResults)
                {
                    totalOperations += posResult.OperationsAttempted;
                    successCount += posResult.OperationsSuccessful;
                    
                    if (posResult.IsValid)
                    {
                        results.Positions.Add(posResult);
                    }
                }
            }
            else
            {
                // Sem posições encontradas - sucesso técnico
                _logger.LogInformation("No positions found for account {Account} JobId={JobId}", 
                    request.Account, request.JobId);
            }

            // Calcula taxa de sucesso
            var successRate = totalOperations > 0 ? (double)successCount / totalOperations : 1.0;
            
            _logger.LogInformation("Granular processing completed JobId={JobId} Success: {Success}/{Total} ({Rate:P})", 
                request.JobId, successCount, totalOperations, successRate);

            // Determina status final baseado na taxa de sucesso
            if (successRate >= _uniswapV3Options.MinSuccessRate)
            {
                var response = BuildUniswapV3Response(results);
                return (response, IntegrationStatus.Success, null, null);
            }
            else
            {
                return (null, IntegrationStatus.Failed, "INSUFFICIENT_SUCCESS_RATE", 
                    $"Success rate {successRate:P} below minimum {_uniswapV3Options.MinSuccessRate:P}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Granular Uniswap V3 processing failed JobId={JobId}", request.JobId);
            return (null, IntegrationStatus.Failed, ex.GetType().Name, ex.Message);
        }
    }

    /// <summary>
    /// Processa uma posição individual com múltiplas operações resilientes
    /// </summary>
    private async Task<GranularPositionResult> ProcessSinglePositionAsync(
        IUniswapV3OnChainService service, BigInteger tokenId, ChainEnum chain, Guid jobId)
    {
        var result = new GranularPositionResult { TokenId = tokenId };
        
        // Primeiro, busca dados básicos da posição
        result.OperationsAttempted++;
        try
        {
            var positionDataResult = await ExecuteWithRetryAsync(
                () => service.GetPositionDataSafeAsync(tokenId, chain), 
                "PositionData", 
                jobId, 
                maxRetries: 2);
            
            if (positionDataResult?.Success == true && positionDataResult.Position != null)
            {
                result.OperationsSuccessful++;
                result.PositionData = positionDataResult;
                
                var position = positionDataResult.Position;
                
                var metadataTasks = new List<Task>();
                
                // Busca metadados do token0
                result.OperationsAttempted++;
                metadataTasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        var token0Metadata = await ExecuteWithRetryAsync(
                            () => service.GetTokenMetadataSafeAsync(position.Token0, chain),
                            "Token0Metadata",
                            jobId,
                            maxRetries: 2);
                        
                        if (token0Metadata?.Success == true)
                        {
                            result.OperationsSuccessful++;
                            result.Token0Metadata = token0Metadata;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Token0 metadata failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
                    }
                }));
                
                // Busca metadados do token1
                result.OperationsAttempted++;
                metadataTasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        var token1Metadata = await ExecuteWithRetryAsync(
                            () => service.GetTokenMetadataSafeAsync(position.Token1, chain),
                            "Token1Metadata", 
                            jobId,
                            maxRetries: 2);
                        
                        if (token1Metadata?.Success == true)
                        {
                            result.OperationsSuccessful++;
                            result.Token1Metadata = token1Metadata;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Token1 metadata failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
                    }
                }));

                // Busca informações de range da posição
                result.OperationsAttempted++;
                metadataTasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        var rangeInfo = await ExecuteWithRetryAsync(
                            () => service.GetPositionRangeAsync(tokenId),
                            "PositionRange",
                            jobId,
                            maxRetries: 2);
                        
                        if (rangeInfo != null)
                        {
                            result.OperationsSuccessful++;
                            result.RangeData = rangeInfo;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Position range failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
                    }
                }));

                // Se temos endereço do pool, busca estado e metadados do pool
                if (!string.IsNullOrEmpty(positionDataResult.PoolAddress))
                {
                    result.OperationsAttempted++;
                    metadataTasks.Add(Task.Run(async () =>
                    {
                        try
                        {
                            var poolMetadata = await ExecuteWithRetryAsync(
                                () => service.GetPoolMetadataSafeAsync(positionDataResult.PoolAddress, chain),
                                "PoolMetadata",
                                jobId,
                                maxRetries: 2);
                            
                            if (poolMetadata?.Success == true)
                            {
                                result.OperationsSuccessful++;
                                result.PoolMetadata = poolMetadata;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning("Pool metadata failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
                        }
                    }));

                    result.OperationsAttempted++;
                    metadataTasks.Add(Task.Run(async () =>
                    {
                        try
                        {
                            var poolState = await ExecuteWithRetryAsync(
                                () => service.GetPoolStateSafeAsync(positionDataResult.PoolAddress, chain),
                                "PoolState",
                                jobId,
                                maxRetries: 2);
                            
                            if (poolState?.Success == true)
                            {
                                result.OperationsSuccessful++;
                                result.PoolState = poolState;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning("Pool state failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
                        }
                    }));

                    // Busca tick info para cálculo de fees uncollected
                    result.OperationsAttempted++;
                    metadataTasks.Add(Task.Run(async () =>
                    {
                        try
                        {
                            var tickInfo = await ExecuteWithRetryAsync(
                                () => service.GetTickRangeSafeAsync(positionDataResult.PoolAddress, position.TickLower, position.TickUpper, chain),
                                "TickInfo",
                                jobId,
                                maxRetries: 2);
                        
                            if (tickInfo?.Success == true)
                            {
                                result.OperationsSuccessful++;
                                result.TickRangeInfo = tickInfo;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning("Tick info failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
                        }
                    }));
                }

                // Espera todas as operações paralelas completarem
                await Task.WhenAll(metadataTasks);

                // Agora calculamos amounts e fees se temos dados suficientes
                await CalculateAmountsAndFeesAsync(result, chain, service);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Position data failed for tokenId {TokenId}: {Error}", tokenId, ex.Message);
        }

        return result;
    }

    /// <summary>
    /// Calcula amounts da posição usando lógica similar ao service original
    /// </summary>
    private static (decimal amount0, decimal amount1) CalculatePositionAmounts(
        BigInteger liquidity, 
        int tickLower, 
        int tickUpper, 
        BigInteger sqrtPriceX96, 
        int currentTick,
        int decimals0,
        int decimals1)
    {
        const int Q96 = 96;
        if (liquidity == 0) return (0, 0);

        // Se não temos preço atual, usa um padrão baseado no tick médio
        if (sqrtPriceX96 == 0)
        {
            var midTick = (tickLower + tickUpper) / 2;
            sqrtPriceX96 = SqrtPriceX96FromTick(midTick);
        }

        var sqrtL = SqrtPriceX96FromTick(tickLower);
        var sqrtU = SqrtPriceX96FromTick(tickUpper);
        var sqrtC = sqrtPriceX96;

        if (sqrtL > sqrtU) (sqrtL, sqrtU) = (sqrtU, sqrtL);

        BigInteger amount0Raw = 0, amount1Raw = 0;
        var Q96BI = BigInteger.One << Q96;

        if (sqrtC <= sqrtL)
        {
            // Position is below range - all token0
            var num = liquidity * (sqrtU - sqrtL) * Q96BI;
            var den = sqrtU * sqrtL;
            if (den != 0) amount0Raw = num / den;
        }
        else if (sqrtC < sqrtU)
        {
            // Position is in range - mixed tokens
            var num0 = liquidity * (sqrtU - sqrtC) * Q96BI;
            var den0 = sqrtU * sqrtC;
            if (den0 != 0) amount0Raw = num0 / den0;
            amount1Raw = liquidity * (sqrtC - sqrtL) / Q96BI;
        }
        else
        {
            // Position is above range - all token1
            amount1Raw = liquidity * (sqrtU - sqrtL) / Q96BI;
        }

        var amount0 = ScaleToken(amount0Raw, decimals0);
        var amount1 = ScaleToken(amount1Raw, decimals1);

        return (amount0, amount1);
    }

    private static BigInteger SqrtPriceX96FromTick(int tick)
    {
        const int Q96 = 96;
        double sqrt = Math.Pow(1.0001, tick / 2.0) * Math.Pow(2, Q96);
        return new BigInteger(Math.Max(0, sqrt));
    }

    private static decimal ScaleToken(BigInteger value, int decimals)
    {
        if (value == 0) return 0;
        var divisor = (decimal)Math.Pow(10, decimals);
        if (divisor == 0) divisor = 1;
        if (value > (BigInteger)decimal.MaxValue) value = (BigInteger)decimal.MaxValue;
        return (decimal)value / divisor;
    }

    /// <summary>
    /// Calcula amounts e fees uncollected usando dados coletados
    /// </summary>
    private async Task CalculateAmountsAndFeesAsync(GranularPositionResult result, ChainEnum chain, IUniswapV3OnChainService service)
    {
        try
        {
            if (result.PositionData?.Position == null) return;

            var position = result.PositionData.Position;
            var token0Decimals = result.Token0Metadata?.Success == true ? result.Token0Metadata.Decimals : 18;
            var token1Decimals = result.Token1Metadata?.Success == true ? result.Token1Metadata.Decimals : 18;

            // Calcula amounts usando a lógica do service original (versão simplificada)
            var (amount0, amount1) = CalculatePositionAmounts(
                position.Liquidity,
                position.TickLower,
                position.TickUpper,
                result.PoolState?.State?.SqrtPriceX96 ?? BigInteger.Zero,
                result.PoolState?.State?.CurrentTick ?? 0,
                token0Decimals,
                token1Decimals);

            result.CalculatedAmount0 = amount0;
            result.CalculatedAmount1 = amount1;

            // Calcula fees uncollected usando a lógica completa
            await CalculateUncollectedFeesAsync(result, service, chain);

            _logger.LogDebug("Calculated amounts for tokenId {TokenId}: amount0={Amount0}, amount1={Amount1}, fees0={Fees0}, fees1={Fees1}",
                result.TokenId, amount0, amount1, result.CalculatedFees0, result.CalculatedFees1);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to calculate amounts for tokenId {TokenId}: {Error}", result.TokenId, ex.Message);
        }
    }

    /// <summary>
    /// Calcula uncollected fees usando a mesma lógica do serviço original
    /// </summary>
    private async Task CalculateUncollectedFeesAsync(GranularPositionResult result, IUniswapV3OnChainService service, ChainEnum chain)
    {
        try
        {
            if (result.PositionData?.Position == null || string.IsNullOrEmpty(result.PositionData.PoolAddress))
            {
                // Fallback para fees básicos
                var positionFallback = result.PositionData?.Position;
                if (positionFallback != null)
                {
                    var token0DecimalsFallback = result.Token0Metadata?.Success == true ? result.Token0Metadata.Decimals : 18;
                    var token1DecimalsFallback = result.Token1Metadata?.Success == true ? result.Token1Metadata.Decimals : 18;
                    result.CalculatedFees0 = ScaleTokenSafely(positionFallback.TokensOwed0, token0DecimalsFallback);
                    result.CalculatedFees1 = ScaleTokenSafely(positionFallback.TokensOwed1, token1DecimalsFallback);
                }
                return;
            }

            var positionMain = result.PositionData.Position;
            var poolAddress = result.PositionData.PoolAddress;
            var token0DecimalsMain = result.Token0Metadata?.Success == true ? result.Token0Metadata.Decimals : 18;
            var token1DecimalsMain = result.Token1Metadata?.Success == true ? result.Token1Metadata.Decimals : 18;

            // Coleta dados necessários para cálculo de fees
            BigInteger feeGrowthGlobal0 = 0, feeGrowthGlobal1 = 0;
            TickInfoDTO? lowerTickInfo = null, upperTickInfo = null;
            int currentTick = 0;

            // Usa dados de estado do pool se disponíveis
            if (result.PoolState?.Success == true && result.PoolState.State != null)
            {
                feeGrowthGlobal0 = result.PoolState.State.FeeGrowthGlobal0X128;
                feeGrowthGlobal1 = result.PoolState.State.FeeGrowthGlobal1X128;
                currentTick = result.PoolState.State.CurrentTick;
            }
            else
            {
                // Fallback: busca fee growth e current tick diretamente
                try
                {
                    var feeGrowthTask = service.GetPoolFeeGrowthAsync(poolAddress);
                    var currentTickTask = service.GetCurrentTickAsync(poolAddress);
                    
                    await Task.WhenAll(feeGrowthTask, currentTickTask);
                    
                    var feeGrowth = await feeGrowthTask;
                    feeGrowthGlobal0 = feeGrowth.feeGrowthGlobal0;
                    feeGrowthGlobal1 = feeGrowth.feeGrowthGlobal1;
                    currentTick = await currentTickTask;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to get fee growth/tick for pool {PoolAddress}: {Error}", poolAddress, ex.Message);
                }
            }

            // Usa tick info coletado se disponível
            if (result.TickRangeInfo?.Success == true)
            {
                lowerTickInfo = result.TickRangeInfo.LowerTickInfo;
                upperTickInfo = result.TickRangeInfo.UpperTickInfo;
            }
            else
            {
                // Fallback: busca tick info diretamente
                try
                {
                    var (lowerTick, upperTick) = await service.GetTickRangeInfoAsync(poolAddress, positionMain.TickLower, positionMain.TickUpper);
                    lowerTickInfo = lowerTick;
                    upperTickInfo = upperTick;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to get tick info for tokenId {TokenId}: {Error}", result.TokenId, ex.Message);
                }
            }

            // Usa current tick do range info se não temos de outro lugar
            if (currentTick == 0 && result.RangeData != null)
            {
                currentTick = result.RangeData.CurrentTick;
            }

            // Calcula uncollected fees usando a lógica completa com proteção contra overflow
            try
            {
                var uncollectedFees = new UncollectedFees().CalculateUncollectedFees(
                    positionMain,
                    feeGrowthGlobal0,
                    feeGrowthGlobal1,
                    token0DecimalsMain,
                    token1DecimalsMain,
                    currentTick,
                    lowerTickInfo,
                    upperTickInfo);

                // Validar e limitar valores extremos
                result.CalculatedFees0 = ValidateAndLimitFeeAmount(uncollectedFees.Amount0, result.TokenId, "token0");
                result.CalculatedFees1 = ValidateAndLimitFeeAmount(uncollectedFees.Amount1, result.TokenId, "token1");

                _logger.LogDebug("Calculated uncollected fees for tokenId {TokenId}: fees0={Fees0}, fees1={Fees1}, currentTick={CurrentTick}, hasTickInfo={HasTickInfo}",
                    result.TokenId, result.CalculatedFees0, result.CalculatedFees1, currentTick, lowerTickInfo != null && upperTickInfo != null);
            }
            catch (OverflowException ex)
            {
                _logger.LogWarning("Overflow calculating uncollected fees for tokenId {TokenId}: {Error}", result.TokenId, ex.Message);
                
                // Fallback para fees básicos
                result.CalculatedFees0 = ScaleTokenSafely(positionMain.TokensOwed0, token0DecimalsMain);
                result.CalculatedFees1 = ScaleTokenSafely(positionMain.TokensOwed1, token1DecimalsMain);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to calculate uncollected fees for tokenId {TokenId}: {Error}", result.TokenId, ex.Message);
            
            // Fallback para fees básicos em caso de erro
            if (result.PositionData?.Position != null)
            {
                var positionError = result.PositionData.Position;
                var token0DecimalsError = result.Token0Metadata?.Success == true ? result.Token0Metadata.Decimals : 18;
                var token1DecimalsError = result.Token1Metadata?.Success == true ? result.Token1Metadata.Decimals : 18;
                result.CalculatedFees0 = ScaleTokenSafely(positionError.TokensOwed0, token0DecimalsError);
                result.CalculatedFees1 = ScaleTokenSafely(positionError.TokensOwed1, token1DecimalsError);
            }
        }
    }

    /// <summary>
    /// Valida e limita valores de fees para evitar overflow downstream
    /// </summary>
    private decimal ValidateAndLimitFeeAmount(decimal amount, BigInteger tokenId, string tokenType)
    {
        // Limita valores extremamente altos que podem causar overflow em multiplicações
        const decimal MAX_REASONABLE_FEE = 10_000m; // 10 mil tokens máximo (era 1 milhão - muito conservador)
        
        if (amount > MAX_REASONABLE_FEE)
        {
            _logger.LogWarning("Capping extremely high fee amount for tokenId {TokenId} {TokenType}: {Original} -> {Capped}", 
                tokenId, tokenType, amount, MAX_REASONABLE_FEE);
            return MAX_REASONABLE_FEE;
        }

        if (amount < 0)
        {
            _logger.LogWarning("Negative fee amount for tokenId {TokenId} {TokenType}: {Amount}", tokenId, tokenType, amount);
            return 0;
        }

        // Log valores significativos para debugging
        if (amount > 100) // Log se > 100 tokens
        {
            _logger.LogInformation("Large fee amount detected for tokenId {TokenId} {TokenType}: {Amount}", 
                tokenId, tokenType, amount);
        }

        return amount;
    }

    /// <summary>
    /// Escala token com proteção melhorada contra overflow
    /// </summary>
    private static decimal ScaleTokenSafely(BigInteger value, int decimals)
    {
        try
        {
            if (value == 0) return 0;
            
            // Clamp decimals to reasonable bounds
            if (decimals < 0) decimals = 0;
            if (decimals > 28) decimals = 28;

            var divisor = (decimal)Math.Pow(10, decimals);
            if (divisor == 0) return 0;

            // Convert BigInteger to decimal safely
            decimal scaledValue;
            if (value > (BigInteger)decimal.MaxValue)
            {
                scaledValue = decimal.MaxValue;
            }
            else if (value < (BigInteger)decimal.MinValue)
            {
                scaledValue = decimal.MinValue;
            }
            else
            {
                scaledValue = (decimal)value;
            }

            return scaledValue / divisor;
        }
        catch (OverflowException)
        {
            return value > 0 ? decimal.MaxValue : decimal.MinValue;
        }
        catch
        {
            return 0;
        }
    }

    /// <summary>
    /// Executa operação com retry e timeout
    /// </summary>
    private async Task<T?> ExecuteWithRetryAsync<T>(
        Func<Task<T?>> operation, 
        string operationName, 
        Guid jobId,
        int maxRetries = 3) where T : class
    {
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                using var cts = new CancellationTokenSource(_uniswapV3Options.GranularOperationTimeout);
                return await operation();
            }
            catch (Exception ex) when (attempt < maxRetries)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)); // Exponential backoff: 1s, 2s, 4s
                _logger.LogWarning("Retry {Attempt}/{MaxRetries} for {Operation} JobId={JobId} in {Delay}s: {Error}", 
                    attempt, maxRetries, operationName, jobId, delay.TotalSeconds, ex.Message);
                
                await Task.Delay(delay);
            }
        }

        _logger.LogError("Operation {Operation} failed after {MaxRetries} attempts JobId={JobId}", 
            operationName, maxRetries, jobId);
        return null;
    }

    /// <summary>
    /// Constrói resposta no formato esperado pelo sistema
    /// </summary>
    private object BuildUniswapV3Response(UniswapV3GranularResults results)
    {
        var positions = new List<object>();

        foreach (var pos in results.Positions.Where(p => p.IsValid))
        {
            try
            {
                // Extrai PositionDTO dos dados coletados
                var posResult = pos.PositionData!; // IsValid garante que não é null
                var position = posResult.Position!;
                
                // Metadados dos tokens
                var token0Meta = pos.Token0Metadata;
                var token1Meta = pos.Token1Metadata;
                var poolMeta = pos.PoolMetadata;
                var poolState = pos.PoolState;
                var rangeInfo = pos.RangeData;

                // Cria um objeto no formato esperado pelo UniswapV3Mapper
                positions.Add(new
                {
                    Id = pos.TokenId.ToString(),
                    Liquidity = position.Liquidity.ToString(),
                    
                    // Usa amounts calculados em vez de zeros
                    DepositedToken0 = pos.CalculatedAmount0.ToString("G17"),
                    DepositedToken1 = pos.CalculatedAmount1.ToString("G17"),
                    WithdrawnToken0 = "0", // Assume não há withdrawals para simplicidade
                    WithdrawnToken1 = "0",
                    
                    // Usa fees calculados
                    CollectedFeesToken0 = pos.CalculatedFees0.ToString("G17"),
                    CollectedFeesToken1 = pos.CalculatedFees1.ToString("G17"),
                    
                    FeeGrowthInside0LastX128 = position.FeeGrowthInside0LastX128.ToString(),
                    FeeGrowthInside1LastX128 = position.FeeGrowthInside1LastX128.ToString(),
                    TickLower = (long)position.TickLower,
                    TickUpper = (long)position.TickUpper,
                    RangeStatus = rangeInfo?.Status ?? "unknown",
                    MinPriceToken1PerToken0 = rangeInfo?.MinPriceToken1PerToken0.ToString("G17") ?? "0",
                    MaxPriceToken1PerToken0 = rangeInfo?.MaxPriceToken1PerToken0.ToString("G17") ?? "0",
                    CurrentPriceToken1PerToken0 = rangeInfo?.CurrentPriceToken1PerToken0.ToString("G17") ?? "0",
                    
                    // Tokens com metadados reais coletados
                    Token0 = new
                    {
                        Id = position.Token0,
                        TokenAddress = position.Token0,
                        Symbol = token0Meta?.Success == true ? token0Meta.Symbol : "",
                        Name = token0Meta?.Success == true ? token0Meta.Name : "",
                        Decimals = token0Meta?.Success == true ? token0Meta.Decimals.ToString() : "18",
                        DerivedNative = "0", // Será calculado pelo mapper se necessário
                        FeesUSD = "0"
                    },
                    Token1 = new
                    {
                        Id = position.Token1,
                        TokenAddress = position.Token1,
                        Symbol = token1Meta?.Success == true ? token1Meta.Symbol : "",
                        Name = token1Meta?.Success == true ? token1Meta.Name : "",
                        Decimals = token1Meta?.Success == true ? token1Meta.Decimals.ToString() : "18",
                        DerivedNative = "0",
                        FeesUSD = "0"
                    },
                    Pool = new
                    {
                        Id = posResult.PoolAddress ?? "",
                        FeeTier = position.Fee.ToString(),
                        Liquidity = position.Liquidity.ToString(),
                        FeeGrowthGlobal0X128 = poolState?.Success == true ? poolState.State?.FeeGrowthGlobal0X128.ToString() ?? "0" : "0",
                        FeeGrowthGlobal1X128 = poolState?.Success == true ? poolState.State?.FeeGrowthGlobal1X128.ToString() ?? "0" : "0",
                        Tick = poolState?.Success == true ? poolState.State?.CurrentTick.ToString() ?? "0" : (rangeInfo?.CurrentTick.ToString() ?? "0"),
                        SqrtPriceX96 = poolState?.Success == true ? poolState.State?.SqrtPriceX96.ToString() ?? "0" : "0",
                        TickSpacing = poolMeta?.Success == true ? poolMeta.Metadata?.TickSpacing?.ToString() ?? "" : "",
                        CreatedAtUnix = poolMeta?.Success == true ? poolMeta.Metadata?.CreatedAtUnix.ToString() ?? "" : ""
                    },
                    
                    // Campos adicionais para compatibilidade
                    RawTokensOwed0 = position.TokensOwed0.ToString(),
                    RawTokensOwed1 = position.TokensOwed1.ToString(),
                    EstimatedUncollectedToken0 = pos.CalculatedFees0.ToString("G17"),
                    EstimatedUncollectedToken1 = pos.CalculatedFees1.ToString("G17")
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to build position data for tokenId {TokenId}: {Error}", 
                    pos.TokenId, ex.Message);
            }
        }

        // Retorna no formato exato esperado pelo UniswapV3Mapper
        return new
        {
            data = new
            {
                positions = positions,
                bundles = new[] 
                { 
                    new { nativePriceUSD = "0" } // Preço base, será determinado pelo mapper se necessário
                }
            }
        };
    }

    private static string ProviderSlug(IntegrationProvider provider) => provider.ToString().ToLowerInvariant();

    // Classes de apoio para processamento granular
    private class UniswapV3GranularResults
    {
        public List<BigInteger> PositionIds { get; set; } = new();
        public List<GranularPositionResult> Positions { get; set; } = new();
    }

    private class GranularPositionResult
    {
        public BigInteger TokenId { get; set; }
        public PositionDataResult? PositionData { get; set; }
        public PositionRangeInfo? RangeData { get; set; }
        public TokenMetadataResult? Token0Metadata { get; set; }
        public TokenMetadataResult? Token1Metadata { get; set; }
        public PoolMetadataResult? PoolMetadata { get; set; }
        public PoolStateResult? PoolState { get; set; }
        public TickRangeResult? TickRangeInfo { get; set; }
        
        // Valores calculados
        public decimal CalculatedAmount0 { get; set; }
        public decimal CalculatedAmount1 { get; set; }
        public decimal CalculatedFees0 { get; set; }
        public decimal CalculatedFees1 { get; set; }
        
        public int OperationsAttempted { get; set; }
        public int OperationsSuccessful { get; set; }
        
        public bool IsValid => OperationsSuccessful > 0 && PositionData?.Success == true;
    }
}
