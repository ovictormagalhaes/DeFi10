using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using StackExchange.Redis;

namespace DeFi10.API.Services.Core;

public sealed class ProofOfWorkService : IProofOfWorkService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ISystemClock _clock;
    private readonly ILogger<ProofOfWorkService> _logger;
    private readonly ProofOfWorkOptions _options;
    
    private const string KeyPrefix = "walletgroup:pow:";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ProofOfWorkService(
        IConnectionMultiplexer redis,
        ISystemClock clock,
        IOptions<ProofOfWorkOptions> options,
        ILogger<ProofOfWorkService> logger)
    {
        _redis = redis;
        _clock = clock;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<(string Challenge, DateTime ExpiresAt)> GenerateChallengeAsync()
    {
        var challenge = GenerateRandomChallenge();
        var ttl = TimeSpan.FromMinutes(_options.ChallengeTTLMinutes);
        var expiresAt = _clock.UtcNow.Add(ttl);
        
        var challengeData = new WalletGroupChallenge
        {
            Challenge = challenge,
            CreatedAt = _clock.UtcNow,
            ExpiresAt = expiresAt
        };

        var db = _redis.GetDatabase();
        var key = GetKey(challenge);
        var json = JsonSerializer.Serialize(challengeData, JsonOptions);
        
        await db.StringSetAsync(key, json, ttl);
        
        _logger.LogInformation("Generated PoW challenge {Challenge} with difficulty {Difficulty}, expires at {ExpiresAt}", 
            challenge, _options.Difficulty, expiresAt);
        
        return (challenge, expiresAt);
    }

    public async Task<bool> ValidateProofAsync(string challenge, string nonce)
    {
        if (string.IsNullOrWhiteSpace(challenge) || string.IsNullOrWhiteSpace(nonce))
        {
            _logger.LogWarning("PoW validation failed: challenge or nonce is empty");
            return false;
        }

        // 1. Verificar se challenge existe no Redis
        var db = _redis.GetDatabase();
        var key = GetKey(challenge);
        var json = await db.StringGetAsync(key);

        if (!json.HasValue)
        {
            _logger.LogWarning("PoW validation failed: challenge {Challenge} not found or expired", challenge);
            return false;
        }

        // 2. Validar PoW: SHA256(challenge + nonce) deve começar com N zeros (hex)
        var isValid = ValidateHash(challenge, nonce);
        
        if (isValid)
        {
            _logger.LogInformation("PoW validation succeeded for challenge {Challenge} with nonce {Nonce}", 
                challenge, nonce);
        }
        else
        {
            _logger.LogWarning("PoW validation failed: hash does not meet difficulty {Difficulty} for challenge {Challenge}", 
                _options.Difficulty, challenge);
        }

        return isValid;
    }

    public async Task InvalidateChallengeAsync(string challenge)
    {
        if (string.IsNullOrWhiteSpace(challenge))
            return;

        var db = _redis.GetDatabase();
        var key = GetKey(challenge);
        var deleted = await db.KeyDeleteAsync(key);
        
        if (deleted)
        {
            _logger.LogInformation("Invalidated PoW challenge {Challenge}", challenge);
        }
    }

    private bool ValidateHash(string challenge, string nonce)
    {
        // Calcula SHA256(challenge + nonce)
        var input = challenge + nonce;
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var hexHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

        // Verifica se começa com N zeros (difficulty = 5 → "00000")
        var requiredPrefix = new string('0', _options.Difficulty);
        return hexHash.StartsWith(requiredPrefix);
    }

    private static string GenerateRandomChallenge()
    {
        // Gera um challenge aleatório de 32 bytes (64 caracteres hex)
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string GetKey(string challenge) => $"{KeyPrefix}{challenge}";
}
