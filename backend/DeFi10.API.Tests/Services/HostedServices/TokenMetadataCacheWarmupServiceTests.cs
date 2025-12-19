using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.HostedServices;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.HostedServices;

public class TokenMetadataCacheWarmupServiceTests
{
    private class FakeServiceProvider : IServiceProvider, IServiceScope
    {
        private readonly Mock<ITokenMetadataService> _mockMetadataService;

        public FakeServiceProvider(Mock<ITokenMetadataService> mockMetadataService)
        {
            _mockMetadataService = mockMetadataService;
        }

        public object? GetService(Type serviceType)
        {
            if (serviceType == typeof(ITokenMetadataService))
                return _mockMetadataService.Object;
            if (serviceType == typeof(IServiceScopeFactory))
                return new FakeServiceScopeFactory(this);
            return null;
        }

        public IServiceProvider ServiceProvider => this;
        
        public void Dispose() { }
    }

    private class FakeServiceScopeFactory : IServiceScopeFactory
    {
        private readonly FakeServiceProvider _provider;

        public FakeServiceScopeFactory(FakeServiceProvider provider)
        {
            _provider = provider;
        }

        public IServiceScope CreateScope() => _provider;
    }

    private readonly Mock<ITokenMetadataService> _mockMetadataService;
    private readonly Mock<ILogger<TokenMetadataCacheWarmupService>> _mockLogger;
    private readonly TokenMetadataCacheWarmupService _sut;

    public TokenMetadataCacheWarmupServiceTests()
    {
        _mockMetadataService = new Mock<ITokenMetadataService>();
        _mockLogger = new Mock<ILogger<TokenMetadataCacheWarmupService>>();

        var fakeProvider = new FakeServiceProvider(_mockMetadataService);
        _sut = new TokenMetadataCacheWarmupService(fakeProvider, _mockLogger.Object);
    }

    [Fact]
    public async Task StartAsync_LoadsMetadataSuccessfully()
    {
        // Arrange
        _mockMetadataService
            .Setup(x => x.LoadAllMetadataIntoMemoryAsync())
            .Returns(Task.CompletedTask);

        // Act
        await _sut.StartAsync(CancellationToken.None);

        // Assert
        _mockMetadataService.Verify(x => x.LoadAllMetadataIntoMemoryAsync(), Times.Once);
    }

    [Fact]
    public async Task StartAsync_WhenLoadingFails_DoesNotThrow()
    {
        // Arrange
        _mockMetadataService
            .Setup(x => x.LoadAllMetadataIntoMemoryAsync())
            .ThrowsAsync(new Exception("Database connection failed"));

        // Act & Assert - should not throw
        await _sut.StartAsync(CancellationToken.None);

        _mockMetadataService.Verify(x => x.LoadAllMetadataIntoMemoryAsync(), Times.Once);
    }

    [Fact]
    public async Task StopAsync_CompletesSuccessfully()
    {
        // Act
        await _sut.StopAsync(CancellationToken.None);

        // Assert - just verify it doesn't throw
        Assert.True(true);
    }

    [Fact]
    public async Task StartAsync_WithCancellationToken_StillExecutes()
    {
        // Arrange
        var cts = new CancellationTokenSource();
        cts.Cancel();

        _mockMetadataService
            .Setup(x => x.LoadAllMetadataIntoMemoryAsync())
            .Returns(Task.CompletedTask);

        // Act
        await _sut.StartAsync(cts.Token);

        // Assert
        _mockMetadataService.Verify(x => x.LoadAllMetadataIntoMemoryAsync(), Times.Once);
    }
}
