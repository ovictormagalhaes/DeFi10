using System.Text.Json;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using DeFi10.API.Services.Helpers;
using Xunit;
using DeFi10.API.Models;
using StackExchange.Redis;

namespace DeFi10.API.Tests.Services.Solana;

public class TokenMetadataServiceTests
{
    [Fact(Skip = "Legacy TokenMetadataService tests - implementation rewritten to MongoDB/in-memory cache")] public void Disabled_LegacyTests_Placeholder() { }
}
