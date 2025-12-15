using DeFi10.API.Infrastructure;
using Xunit;

namespace DeFi10.API.Tests.Infrastructure;

public class SystemClockTests
{
    [Fact]
    public void UtcNow_ReturnsCurrentUtcTime()
    {
        var sut = new SystemClock();
        var before = DateTime.UtcNow;
        
        var result = sut.UtcNow;
        
        var after = DateTime.UtcNow;
        
        Assert.InRange(result, before.AddMilliseconds(-10), after.AddMilliseconds(10));
    }

    [Fact]
    public void UtcNow_CalledMultipleTimes_ReturnsProgressingTime()
    {
        var sut = new SystemClock();
        
        var first = sut.UtcNow;
        Thread.Sleep(10);
        var second = sut.UtcNow;
        
        Assert.True(second >= first);
    }

    [Fact]
    public void UtcNow_ReturnsUtcKind()
    {
        var sut = new SystemClock();
        
        var result = sut.UtcNow;
        
        Assert.Equal(DateTimeKind.Utc, result.Kind);
    }
}
