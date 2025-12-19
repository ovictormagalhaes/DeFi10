using System.Text;
using System.Text.Json;
using DeFi10.API.Configuration;
using DeFi10.API.Events;
using DeFi10.API.Messaging.Rabbit;

namespace DeFi10.API.Services.Events;

public interface ITokenPriceUpdatePublisher
{
    Task PublishPriceUpdateEventAsync(TokenPriceUpdateEvent evt);
}

public sealed class TokenPriceUpdatePublisher : ITokenPriceUpdatePublisher
{
    private readonly IMessagePublisher _messagePublisher;
    private readonly ILogger<TokenPriceUpdatePublisher> _logger;
    
    private const string ROUTING_KEY = "token.price.update";

    public TokenPriceUpdatePublisher(
        IMessagePublisher messagePublisher,
        ILogger<TokenPriceUpdatePublisher> logger)
    {
        _messagePublisher = messagePublisher;
        _logger = logger;
    }

    public async Task PublishPriceUpdateEventAsync(TokenPriceUpdateEvent evt)
    {
        try
        {
            await _messagePublisher.PublishAsync(ROUTING_KEY, evt);

            _logger.LogDebug("[TokenPricePublisher] Published batch event with {Count} tokens",
                evt.Tokens.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPricePublisher] Failed to publish event with {Count} tokens", 
                evt.Tokens.Count);
            throw;
        }
    }
}
