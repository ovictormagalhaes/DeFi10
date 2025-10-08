using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MyWebWallet.API.Messaging.Rabbit;

public interface IMessagePublisher
{
    Task PublishAsync(string routingKey, object message, CancellationToken ct = default);
}

public class RabbitMqPublisher : IMessagePublisher, IDisposable
{
    private readonly IRabbitMqConnectionFactory _connectionFactory;
    private readonly RabbitMqOptions _options;
    private readonly ILogger<RabbitMqPublisher> _logger;
    private readonly IConfiguration _configuration;
    private IModel? _channel;
    private readonly SemaphoreSlim _initLock = new(1,1);
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public RabbitMqPublisher(IRabbitMqConnectionFactory connectionFactory, IOptions<RabbitMqOptions> options, ILogger<RabbitMqPublisher> logger, IConfiguration configuration)
    {
        _connectionFactory = connectionFactory;
        _options = options.Value;
        _logger = logger;
        _configuration = configuration;
    }

    private IModel GetOrCreateChannel()
    {
        if (_channel is { IsOpen: true }) return _channel;
        var connection = _connectionFactory.GetConnection();
        _channel = connection.CreateModel();
        _channel.ExchangeDeclare(_options.Exchange, ExchangeType.Topic, durable: true, autoDelete: false);
        if (_options.PublisherConfirms) _channel.ConfirmSelect();
        return _channel;
    }

    public async Task PublishAsync(string routingKey, object message, CancellationToken ct = default)
    {
        await _initLock.WaitAsync(ct);
        try
        {
            var ch = GetOrCreateChannel();
            var body = JsonSerializer.SerializeToUtf8Bytes(message, _jsonOptions);
            var props = ch.CreateBasicProperties();
            props.ContentType = "application/json";
            props.DeliveryMode = 2; // persistent
            props.MessageId = Guid.NewGuid().ToString();
            props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            
            ch.BasicPublish(exchange: _options.Exchange, routingKey: routingKey, mandatory: false, basicProperties: props, body: body);
            
            if (_options.PublisherConfirms)
            {
                // Configurável via appsettings, default 30s (era 5s)
                var confirmTimeoutSeconds = _configuration.GetValue<int?>("RabbitMQ:PublisherConfirmTimeoutSeconds") ?? 30;
                var timeout = TimeSpan.FromSeconds(Math.Clamp(confirmTimeoutSeconds, 5, 120));
                
                _logger.LogTrace("Waiting for publisher confirm routingKey={RoutingKey} timeout={Timeout}s", routingKey, timeout.TotalSeconds);
                ch.WaitForConfirmsOrDie(timeout);
                _logger.LogTrace("Publisher confirm received routingKey={RoutingKey}", routingKey);
            }
        }
        catch (TimeoutException tex)
        {
            _logger.LogError(tex, "Publisher confirm timeout for routingKey {RoutingKey} after waiting. This may indicate RabbitMQ broker issues.", routingKey);
            
            // Recreate channel on timeout - it might be in a bad state
            try 
            { 
                _channel?.Close(); 
                _channel?.Dispose(); 
            } 
            catch 
            { 
                /* ignore cleanup errors */ 
            }
            _channel = null;
            
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish message to routingKey {RoutingKey}", routingKey);
            throw;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public void Dispose()
    {
        try 
        { 
            _channel?.Dispose(); 
        } 
        catch 
        { 
            /* ignore cleanup errors */ 
        }
        _initLock?.Dispose();
    }
}
