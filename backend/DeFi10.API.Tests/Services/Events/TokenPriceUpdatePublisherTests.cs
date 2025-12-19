using DeFi10.API.Configuration;
using DeFi10.API.Events;
using DeFi10.API.Messaging.Rabbit;
using DeFi10.API.Services.Events;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Events;

public class TokenPriceUpdatePublisherTests
{
    private readonly FakeMessagePublisher _fakePublisher;
    private readonly Mock<ILogger<TokenPriceUpdatePublisher>> _mockLogger;
    private readonly TokenPriceUpdatePublisher _sut;

    public TokenPriceUpdatePublisherTests()
    {
        _fakePublisher = new FakeMessagePublisher();
        _mockLogger = new Mock<ILogger<TokenPriceUpdatePublisher>>();
        _sut = new TokenPriceUpdatePublisher(_fakePublisher, _mockLogger.Object);
    }

    [Fact]
    public async Task PublishPriceUpdateEventAsync_WithValidEvent_PublishesSuccessfully()
    {
        // Arrange
        var evt = new TokenPriceUpdateEvent
        {
            Tokens = new List<TokenPriceUpdateRequest>
            {
                new() { Symbol = "ETH", Chain = DeFi10.API.Models.Chain.Ethereum, Address = "0x123", CurrentPrice = 2000m }
            }
        };

        // Act
        await _sut.PublishPriceUpdateEventAsync(evt);

        // Assert
        Assert.Equal(1, _fakePublisher.PublishCount);
        Assert.Equal("token.price.update", _fakePublisher.LastRoutingKey);
        Assert.Same(evt, _fakePublisher.LastEvent);
    }

    [Fact]
    public async Task PublishPriceUpdateEventAsync_WithEmptyTokenList_StillPublishes()
    {
        // Arrange
        var evt = new TokenPriceUpdateEvent { Tokens = new List<TokenPriceUpdateRequest>() };

        // Act
        await _sut.PublishPriceUpdateEventAsync(evt);

        // Assert
        Assert.Equal(1, _fakePublisher.PublishCount);
    }

    [Fact]
    public async Task PublishPriceUpdateEventAsync_WhenPublisherThrows_RethrowsException()
    {
        // Arrange
        var evt = new TokenPriceUpdateEvent
        {
            Tokens = new List<TokenPriceUpdateRequest>
            {
                new() { Symbol = "BTC", Chain = DeFi10.API.Models.Chain.Ethereum, Address = "0x456", CurrentPrice = 40000m }
            }
        };
        
        _fakePublisher.ShouldThrow = true;

        // Act & Assert
        await Assert.ThrowsAsync<Exception>(() => _sut.PublishPriceUpdateEventAsync(evt));
    }

    [Fact]
    public async Task PublishPriceUpdateEventAsync_WithMultipleTokens_PublishesBatch()
    {
        // Arrange
        var evt = new TokenPriceUpdateEvent
        {
            Tokens = new List<TokenPriceUpdateRequest>
            {
                new() { Symbol = "ETH", Chain = DeFi10.API.Models.Chain.Ethereum, Address = "0x123", CurrentPrice = 2000m },
                new() { Symbol = "USDC", Chain = DeFi10.API.Models.Chain.Ethereum, Address = "0x456", CurrentPrice = 1m },
                new() { Symbol = "DAI", Chain = DeFi10.API.Models.Chain.Ethereum, Address = "0x789", CurrentPrice = 1m }
            }
        };

        // Act
        await _sut.PublishPriceUpdateEventAsync(evt);

        // Assert
        Assert.Equal(1, _fakePublisher.PublishCount);
        Assert.Equal(3, evt.Tokens.Count);
    }

    private class FakeMessagePublisher : IMessagePublisher
    {
        public int PublishCount { get; private set; }
        public string? LastRoutingKey { get; private set; }
        public TokenPriceUpdateEvent? LastEvent { get; private set; }
        public bool ShouldThrow { get; set; }

        public Task PublishAsync(string routingKey, object message, CancellationToken ct = default)
        {
            if (ShouldThrow)
                throw new Exception("RabbitMQ connection failed");

            PublishCount++;
            LastRoutingKey = routingKey;
            if (message is TokenPriceUpdateEvent evt)
                LastEvent = evt;

            return Task.CompletedTask;
        }
    }
}
