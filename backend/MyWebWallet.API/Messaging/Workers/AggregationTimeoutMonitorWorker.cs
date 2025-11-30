using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyWebWallet.API.Configuration;
using MyWebWallet.API.Messaging.Contracts.Enums;
using MyWebWallet.API.Messaging.Contracts.Progress;
using MyWebWallet.API.Messaging.Rabbit;
using RabbitMQ.Client;
using StackExchange.Redis;

namespace MyWebWallet.API.Messaging.Workers;


public class AggregationTimeoutMonitorWorker : BackgroundService
{
    private readonly ILogger<AggregationTimeoutMonitorWorker> _logger;
    private readonly IConnectionMultiplexer _redis;
    private readonly IMessagePublisher _publisher;
    private readonly TimeSpan _scanInterval;
    private readonly TimeSpan _jobTimeout;

    public AggregationTimeoutMonitorWorker(
        ILogger<AggregationTimeoutMonitorWorker> logger,
        IConnectionMultiplexer redis,
        IMessagePublisher publisher,
        IOptions<AggregationOptions> aggregationOptions)
    {
        _logger = logger;
        _redis = redis;
        _publisher = publisher;
        var options = aggregationOptions.Value;
        _scanInterval = TimeSpan.FromSeconds(Math.Clamp(options.TimeoutScanSeconds, 5, 300));
        _jobTimeout = TimeSpan.FromSeconds(Math.Clamp(options.JobTimeoutSeconds, 30, 3600));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AggregationTimeoutMonitorWorker started scanInterval={Scan}s jobTimeout={Timeout}s", _scanInterval.TotalSeconds, _jobTimeout.TotalSeconds);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ScanAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Timeout scan cycle failed");
            }
            await Task.Delay(_scanInterval, stoppingToken);
        }
    }

    private async Task ScanAsync(CancellationToken ct)
    {
        var endpoints = _redis.GetEndPoints();
        if (endpoints.Length == 0) 
        {
            _logger.LogWarning("No Redis endpoints available for timeout scanning");
            return;
        }
        
        var server = _redis.GetServer(endpoints[0]);
        var db = _redis.GetDatabase();
        var now = DateTime.UtcNow;
        
        var scannedJobs = 0;
        var activeJobs = 0;
        var timedOutJobs = 0;

        try
        {

            foreach (var key in server.Keys(pattern: "wallet:agg:*:meta"))
            {
                ct.ThrowIfCancellationRequested();
                scannedJobs++;
                
                try
                {
                    var metaEntries = await db.HashGetAllAsync(key);
                    if (metaEntries.Length == 0) continue;
                    var meta = metaEntries.ToDictionary(x => x.Name.ToString(), x => x.Value.ToString());
                    
                    if (!meta.TryGetValue("status", out var statusStr)) continue;
                    if (!meta.TryGetValue("created_at", out var createdStr)) continue;
                    if (!meta.TryGetValue("final_emitted", out var finalEmittedStr)) finalEmittedStr = "0";

                    if (finalEmittedStr == "1") continue;

                    if (!Enum.TryParse<AggregationStatus>(statusStr, true, out var aggStatus)) continue;
                    if (aggStatus is AggregationStatus.Completed or AggregationStatus.CompletedWithErrors or AggregationStatus.TimedOut or AggregationStatus.Cancelled)
                        continue;

                    activeJobs++;

                    if (!DateTime.TryParse(createdStr, out var createdAt)) continue;
                    var age = now - createdAt;

                    var jobIdFromKey = ExtractJobIdFromKey(key.ToString());
                    _logger.LogDebug("Active job found: {JobId} status={Status} age={Age}s remaining={Remaining}s", 
                        jobIdFromKey, aggStatus, (int)age.TotalSeconds, (int)(_jobTimeout - age).TotalSeconds);
                    
                    if (age < _jobTimeout) continue;

                    if (!Guid.TryParse(jobIdFromKey, out var jobId)) continue;

                    var account = meta.TryGetValue("account", out var acc) ? acc : "unknown";
                    var expectedTotal = meta.TryGetValue("expected_total", out var exp) ? exp : "0";
                    var succeeded = meta.TryGetValue("succeeded", out var succ) ? succ : "0";
                    var failed = meta.TryGetValue("failed", out var fail) ? fail : "0";

                    _logger.LogWarning("Job exceeds timeout: {JobId} account={Account} age={Age}s expected={Expected} succeeded={Succeeded} failed={Failed}", 
                        jobId, account, (int)age.TotalSeconds, expectedTotal, succeeded, failed);

                    var pendingKey = $"wallet:agg:{jobId}:pending";
                    var pendingCount = (int)await db.SetLengthAsync(pendingKey);

                    var finalCheck = await db.HashGetAsync(key, "final_emitted");
                    if (finalCheck == "1") 
                    {
                        _logger.LogDebug("Job {JobId} was finalized by another process, skipping timeout", jobId);
                        continue;
                    }

                    var tran = db.CreateTransaction();
                    if (pendingCount > 0)
                    {
                        tran.HashIncrementAsync(key, "timed_out", pendingCount);
                    }
                    tran.HashSetAsync(key, new HashEntry[]
                    {
                        new("status", AggregationStatus.TimedOut.ToString()),
                        new("final_emitted", 1)
                    });
                    var exec = await tran.ExecuteAsync();
                    if (!exec)
                    {
                        _logger.LogWarning("Transaction failed marking timeout jobId={JobId}", jobId);
                        continue;
                    }

                    int succeededCount = (int)(long)(await db.HashGetAsync(key, "succeeded"));
                    int failedCount = (int)(long)(await db.HashGetAsync(key, "failed"));
                    int timedOutCount = (int)(long)(await db.HashGetAsync(key, "timed_out"));
                    int expectedCount = (int)(long)(await db.HashGetAsync(key, "expected_total"));

                    var evt = new WalletAggregationCompleted(
                        JobId: jobId,
                        Account: account,
                        Status: AggregationStatus.TimedOut,
                        CompletedAtUtc: DateTime.UtcNow,
                        Total: expectedCount,
                        Succeeded: succeededCount,
                        Failed: failedCount,
                        TimedOut: timedOutCount
                    );
                    
                    _logger.LogWarning("Job timed out and marked: jobId={JobId} expected={Expected} succ={Succ} fail={Fail} timedOut={TO} pendingRemoved={Pending}", 
                        jobId, expectedCount, succeededCount, failedCount, timedOutCount, pendingCount);
                    
                    await _publisher.PublishAsync("aggregation.completed", evt, ct);
                    timedOutJobs++;
                }
                catch (Exception exInner)
                {
                    _logger.LogError(exInner, "Failed processing meta key {Key}", key);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Redis key enumeration");
        }

        if (scannedJobs > 0 || activeJobs > 0 || timedOutJobs > 0)
        {
            _logger.LogInformation("Timeout scan completed: scanned={Scanned} active={Active} timedOut={TimedOut}", 
                scannedJobs, activeJobs, timedOutJobs);
        }
        else
        {
            _logger.LogDebug("Timeout scan completed: no aggregation jobs found");
        }
    }

    private static string ExtractJobIdFromKey(string key)
    {

        var parts = key.Split(':', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 3 ? parts[2] : "unknown";
    }
}