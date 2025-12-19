using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using DeFi10.API.Configuration;
using DeFi10.API.Events;
using DeFi10.API.Messaging.Rabbit;
using DeFi10.API.Repositories.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace DeFi10.API.BackgroundServices;

public sealed class TokenPriceUpdateBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IRabbitMqConnectionFactory _connectionFactory;
    private readonly ILogger<TokenPriceUpdateBackgroundService> _logger;
    private readonly TokenCacheOptions _options;
    private readonly RabbitMqOptions _rabbitOptions;
    private readonly ConcurrentDictionary<string, TokenPriceUpdateRequest> _pendingUpdates;
    private IModel? _channel;
    
    private const string QUEUE_NAME = "token.price.updates";
    private const string ROUTING_KEY = "token.price.update";

    public TokenPriceUpdateBackgroundService(
        IServiceProvider serviceProvider,
        IRabbitMqConnectionFactory connectionFactory,
        ILogger<TokenPriceUpdateBackgroundService> logger,
        IOptions<TokenCacheOptions> options,
        IOptions<RabbitMqOptions> rabbitOptions)
    {
        _serviceProvider = serviceProvider;
        _connectionFactory = connectionFactory;
        _logger = logger;
        _options = options.Value;
        _rabbitOptions = rabbitOptions.Value;
        _pendingUpdates = new ConcurrentDictionary<string, TokenPriceUpdateRequest>(StringComparer.OrdinalIgnoreCase);
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenPriceUpdate] Starting background service...");
        
        try
        {
            InitializeRabbitMQ();
            _logger.LogInformation("[TokenPriceUpdate] RabbitMQ connection established");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPriceUpdate] Failed to initialize RabbitMQ");
            throw;
        }
        
        await base.StartAsync(cancellationToken);
    }

    private void InitializeRabbitMQ()
    {
        var connection = _connectionFactory.GetConnection();
        _channel = connection.CreateModel();
        
        // Declare queue
        _channel.QueueDeclare(
            queue: QUEUE_NAME,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null);
        
        // Bind to exchange
        _channel.QueueBind(
            queue: QUEUE_NAME,
            exchange: _rabbitOptions.Exchange,
            routingKey: ROUTING_KEY);
        
        // QoS: Prefetch count para processar em lote
        _channel.BasicQos(
            prefetchSize: 0,
            prefetchCount: (ushort)_options.BatchSize,
            global: false);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[TokenPriceUpdate] Background service started. Interval={IntervalSeconds}s, BatchSize={BatchSize}",
            _options.WorkerProcessIntervalSeconds, _options.BatchSize);

        var consumer = new EventingBasicConsumer(_channel!);
        
        consumer.Received += (model, ea) =>
        {
            try
            {
                var body = ea.Body.ToArray();
                var json = Encoding.UTF8.GetString(body);
                var evt = JsonSerializer.Deserialize<TokenPriceUpdateEvent>(json);
                
                if (evt?.Tokens != null)
                {
                    // ? DEDUPLICA��O: Adiciona cada token ao dicion�rio (sobrescreve duplicatas)
                    foreach (var token in evt.Tokens)
                    {
                        var key = token.GetDeduplicationKey();
                        _pendingUpdates[key] = token;
                    }
                    
                    _logger.LogDebug("[TokenPriceUpdate] Enqueued batch with {Count} tokens (total pending: {Pending})",
                        evt.Tokens.Count, _pendingUpdates.Count);
                }
                
                _channel!.BasicAck(ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TokenPriceUpdate] Failed to process message");
                _channel!.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
            }
        };

        _channel!.BasicConsume(
            queue: QUEUE_NAME,
            autoAck: false,
            consumer: consumer);

        // ? WORKER LOOP: Processa lote periodicamente
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_options.WorkerProcessIntervalSeconds));
        
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (_pendingUpdates.IsEmpty)
            {
                _logger.LogDebug("[TokenPriceUpdate] No pending updates");
                continue;
            }

            await ProcessPendingUpdatesAsync(stoppingToken);
        }
    }

    private async Task ProcessPendingUpdatesAsync(CancellationToken ct)
    {
        // Captura snapshot dos eventos pendentes
        var tokensToProcess = _pendingUpdates.Values.ToList();
        _pendingUpdates.Clear();

        if (tokensToProcess.Count == 0)
            return;

        _logger.LogInformation("[TokenPriceUpdate] Processing batch of {Count} unique tokens", tokensToProcess.Count);

        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<ITokenMetadataRepository>();
        var cmcService = scope.ServiceProvider.GetRequiredService<ICoinMarketCapService>();

        var symbolsToUpdate = tokensToProcess
            .Select(t => t.Symbol)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        try
        {
            // ? BUSCAR PRE�OS ATUALIZADOS DO CMC (lote)
            var cmcResponse = await cmcService.GetQuotesLatestV2Async(symbolsToUpdate, ct);
            
            if (cmcResponse?.Data == null)
            {
                _logger.LogWarning("[TokenPriceUpdate] CMC returned no data");
                return;
            }

            var documentsToUpdate = new List<Models.Persistence.TokenMetadataDocument>();
            
            foreach (var token in tokensToProcess)
            {
                try
                {
                    // Buscar documento existente
                    var doc = await repository.GetByChainAndAddressAsync((int)token.Chain, token.Address, ct);
                    
                    if (doc == null)
                    {
                        _logger.LogWarning("[TokenPriceUpdate] Token not found in DB: {Symbol} (chain={Chain})",
                            token.Symbol, token.Chain);
                        continue;
                    }

                    // Tentar obter pre�o atualizado do CMC
                    if (cmcResponse.Data.TryGetValue(token.Symbol.ToUpperInvariant(), out var quote))
                    {
                        if (quote.Quote.TryGetValue("USD", out var usdQuote) && usdQuote.Price.HasValue && usdQuote.Price.Value > 0)
                        {
                            doc.PriceUsd = usdQuote.Price.Value;
                            doc.UpdatedAt = DateTime.UtcNow;
                            documentsToUpdate.Add(doc);
                            
                            _logger.LogDebug("[TokenPriceUpdate] Updated price for {Symbol}: ${Price}",
                                token.Symbol, usdQuote.Price.Value);
                        }
                        else
                        {
                            _logger.LogWarning("[TokenPriceUpdate] Invalid price from CMC for {Symbol}: {Price}",
                                token.Symbol, usdQuote.Price);
                        }
                    }
                    else
                    {
                        _logger.LogDebug("[TokenPriceUpdate] No CMC data for {Symbol}", token.Symbol);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[TokenPriceUpdate] Failed to process token {Symbol}", token.Symbol);
                }
            }

            // ? BULK UPDATE no MongoDB
            if (documentsToUpdate.Any())
            {
                await repository.BulkUpsertAsync(documentsToUpdate, ct);
                
                _logger.LogInformation("[TokenPriceUpdate] Successfully updated {Count} token prices in MongoDB",
                    documentsToUpdate.Count);
            }
            else
            {
                _logger.LogWarning("[TokenPriceUpdate] No valid prices to update");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPriceUpdate] Failed to process batch");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenPriceUpdate] Stopping background service...");
        
        if (_channel != null)
        {
            _channel.Close();
            _channel.Dispose();
        }
        
        await base.StopAsync(cancellationToken);
    }
}
