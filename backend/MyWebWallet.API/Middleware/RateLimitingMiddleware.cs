using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MyWebWallet.API.Middleware;


public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly RateLimitOptions _options;

    private static readonly ConcurrentDictionary<string, RateLimitCounter> _localCache = new();

    public RateLimitingMiddleware(
        RequestDelegate next,
        ILogger<RateLimitingMiddleware> logger,
        IOptions<RateLimitOptions> options)
    {
        _next = next;
        _logger = logger;
        _options = options.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {

        if (context.Request.Path.StartsWithSegments("/health"))
        {
            await _next(context);
            return;
        }

        var clientId = GetClientIdentifier(context);
        var endpoint = $"{context.Request.Method}:{context.Request.Path}";

        if (!IsRateLimitExceeded(clientId, endpoint, out var retryAfter))
        {
            await _next(context);
        }
        else
        {
            await HandleRateLimitExceeded(context, clientId, endpoint, retryAfter);
        }
    }

    private string GetClientIdentifier(HttpContext context)
    {

        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private bool IsRateLimitExceeded(string clientId, string endpoint, out int retryAfter)
    {
        retryAfter = 0;

        if (!_options.Enabled)
            return false;

        var key = $"ratelimit:{clientId}:{endpoint}";
        var now = DateTimeOffset.UtcNow;

        var counter = _localCache.GetOrAdd(key, _ => new RateLimitCounter());

        lock (counter)
        {

            counter.Timestamps.RemoveAll(t => now - t > _options.Window);

            if (counter.Timestamps.Count >= _options.MaxRequests)
            {

                var oldestTimestamp = counter.Timestamps.Min();
                var windowEnd = oldestTimestamp + _options.Window;
                retryAfter = (int)(windowEnd - now).TotalSeconds + 1;

                _logger.LogWarning(
                    "Rate limit exceeded for client {ClientId} on endpoint {Endpoint}. Requests: {Count}/{Max} in {Window}s",
                    clientId,
                    endpoint,
                    counter.Timestamps.Count,
                    _options.MaxRequests,
                    _options.Window.TotalSeconds);

                return true;
            }

            counter.Timestamps.Add(now);
        }

        if (_localCache.Count > 1000)
        {
            CleanupExpiredEntries();
        }

        return false;
    }

    private void CleanupExpiredEntries()
    {
        var now = DateTimeOffset.UtcNow;
        var keysToRemove = _localCache
            .Where(kvp =>
            {
                lock (kvp.Value)
                {
                    return !kvp.Value.Timestamps.Any() ||
                           kvp.Value.Timestamps.All(t => now - t > _options.Window * 2);
                }
            })
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in keysToRemove)
        {
            _localCache.TryRemove(key, out _);
        }
    }

    private async Task HandleRateLimitExceeded(HttpContext context, string clientId, string endpoint, int retryAfter)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();

        context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
        context.Response.ContentType = "application/json";
        context.Response.Headers["Retry-After"] = retryAfter.ToString();
        context.Response.Headers["X-Rate-Limit-Limit"] = _options.MaxRequests.ToString();
        context.Response.Headers["X-Rate-Limit-Window"] = _options.Window.TotalSeconds.ToString();

        var errorResponse = new
        {
            statusCode = 429,
            message = "Rate limit exceeded. Too many requests.",
            correlationId,
            retryAfter,
            limit = _options.MaxRequests,
            windowSeconds = (int)_options.Window.TotalSeconds,
            timestamp = DateTimeOffset.UtcNow
        };

        var json = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }

    private class RateLimitCounter
    {
        public List<DateTimeOffset> Timestamps { get; } = new();
    }
}
