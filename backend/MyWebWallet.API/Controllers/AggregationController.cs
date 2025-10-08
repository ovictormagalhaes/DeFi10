using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using MyWebWallet.API.Messaging.Contracts;
using System.Text.Json;
using System.Text.Json.Serialization;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services; // EthereumService
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation; // RedisKeys

namespace MyWebWallet.API.Controllers;

[ApiController]
[Route("api/v1/aggregations")] // versioned route
public class AggregationController : ControllerBase
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IBlockchainService _blockchainService;
    private readonly ILogger<AggregationController> _logger;
    private static readonly JsonSerializerOptions EnumJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly ChainEnum[] DefaultChains = new[] { ChainEnum.Base, ChainEnum.BNB, ChainEnum.Arbitrum, ChainEnum.Ethereum };
    private const string MetaPattern = "wallet:agg:*:meta"; // used only where index not yet implemented

    public AggregationController(IConnectionMultiplexer redis, IBlockchainService blockchainService, ILogger<AggregationController> logger)
    {
        _redis = redis;
        _blockchainService = blockchainService;
        _logger = logger;
    }

    // Request DTO (JSON body)
    public sealed class AggregationStartRequest
    {
        public string? Account { get; set; }
        public string[]? Chains { get; set; }
    }

    private static string ActiveJobKey(string accountLower, ChainEnum chain) => RedisKeys.ActiveSingle(accountLower, chain); // use central RedisKeys

    [HttpPost]
    public async Task<IActionResult> Start([FromBody] AggregationStartRequest request)
    {
        if (request is null) return BadRequest(new { error = "payload required" });
        var account = request.Account?.Trim();
        if (string.IsNullOrWhiteSpace(account)) return BadRequest(new { error = "account required" });
        if (_blockchainService is not EthereumService eth)
            return BadRequest(new { error = "Unsupported blockchain service for aggregation start" });

        try
        {
            var resolved = new List<ChainEnum>();
            var chains = request.Chains;
            if (chains != null && chains.Length > 0)
            {
                foreach (var entry in chains)
                {
                    if (string.IsNullOrWhiteSpace(entry)) continue;
                    foreach (var part in entry.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    {
                        if (Enum.TryParse<ChainEnum>(part, true, out var parsed) && !resolved.Contains(parsed))
                            resolved.Add(parsed);
                        else if (!Enum.TryParse<ChainEnum>(part, true, out _))
                            return BadRequest(new { error = $"Invalid chain '{part}'" });
                    }
                }
            }
            if (resolved.Count == 0)
            {
                resolved.AddRange(DefaultChains);
            }

            Guid jobId = resolved.Count == 1
                ? await eth.StartAsyncAggregation(account, resolved[0])
                : await eth.StartAsyncAggregation(account, resolved);

            var reused = await DetermineReuseAsync(account, resolved, jobId);

            return Ok(new { account, chains = resolved.Select(c => c.ToString()).ToList(), jobId, reused });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start aggregation for account={Account}", request.Account);
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task<bool> DetermineReuseAsync(string account, List<ChainEnum> resolved, Guid jobId)
    {
        var db = _redis.GetDatabase();
        var acctLower = account.ToLowerInvariant();
        if (resolved.Count == 1)
        {
            var activeKey = ActiveJobKey(acctLower, resolved[0]);
            var existingVal = await db.StringGetAsync(activeKey);
            if (existingVal.HasValue && Guid.TryParse(existingVal.ToString(), out var existingJob) && existingJob == jobId)
                return true;
            return false;
        }
        else
        {
            var multiKey = RedisKeys.ActiveMulti(acctLower, resolved);
            var existingVal = await db.StringGetAsync(multiKey);
            if (existingVal.HasValue && Guid.TryParse(existingVal.ToString(), out var existingJob) && existingJob == jobId)
                return true;
            return false;
        }
    }

    [HttpGet("account/{account}")]
    public async Task<IActionResult> GetByAccount(string account, [FromQuery] ChainEnum chain = ChainEnum.Base)
    {
        if (string.IsNullOrWhiteSpace(account)) return BadRequest("account required");
        var db = _redis.GetDatabase();
        var acctLower = account.ToLowerInvariant();
        var activeKey = ActiveJobKey(acctLower, chain);
        var jobIdVal = await db.StringGetAsync(activeKey);
        if (!jobIdVal.HasValue || !Guid.TryParse(jobIdVal.ToString(), out var jobId))
        {
            var server = _redis.GetServer(_redis.GetEndPoints().First());
            var db2 = _redis.GetDatabase();
            Guid? latestJob = null; DateTime latestCreated = DateTime.MinValue;
            foreach (var key in server.Keys(pattern: MetaPattern))
            {
                try
                {
                    var parts = key.ToString().Split(':');
                    if (parts.Length < 4) continue;
                    if (!Guid.TryParse(parts[2], out var candidateJob)) continue;
                    var acctVal = await db2.HashGetAsync(key, "account");
                    if (!acctVal.HasValue || !acctVal.ToString().Equals(acctLower, StringComparison.OrdinalIgnoreCase)) continue;
                    var createdVal = await db2.HashGetAsync(key, "created_at");
                    if (!createdVal.HasValue || !DateTime.TryParse(createdVal.ToString(), out var createdAt)) continue;
                    if (createdAt > latestCreated) { latestCreated = createdAt; latestJob = candidateJob; }
                }
                catch { }
            }
            if (latestJob.HasValue)
                return await BuildSnapshotAsync(latestJob.Value);
            return NotFound(new { error = "no active job" });
        }
        return await BuildSnapshotAsync(jobId);
    }

    [HttpGet("{jobId:guid}")]
    public async Task<IActionResult> GetAggregation(Guid jobId) => await BuildSnapshotAsync(jobId);

    [HttpGet]
    public async Task<IActionResult> ListByAccount([FromQuery] string? account, [FromQuery] int limit = 20)
    {
        if (string.IsNullOrWhiteSpace(account)) return BadRequest(new { error = "account required" });
        var acctLower = account.ToLowerInvariant();
        var db = _redis.GetDatabase();
        var server = _redis.GetServer(_redis.GetEndPoints().First());
        var jobs = new List<object>();
        foreach (var key in server.Keys(pattern: MetaPattern))
        {
            if (jobs.Count >= limit) break;
            try
            {
                var parts = key.ToString().Split(':');
                if (parts.Length < 4) continue;
                if (!Guid.TryParse(parts[2], out var jobId)) continue;
                var acctVal = await db.HashGetAsync(key, "account");
                if (!acctVal.HasValue || !acctVal.ToString().Equals(acctLower, StringComparison.OrdinalIgnoreCase)) continue;
                var createdVal = await db.HashGetAsync(key, "created_at");
                DateTime createdAt;
                if (!createdVal.HasValue || !DateTime.TryParse(createdVal.ToString(), out createdAt)) createdAt = DateTime.MinValue;
                var statusVal = await db.HashGetAsync(key, "status");
                var chainsVal = await db.HashGetAsync(key, "chains");
                var expectedVal = await db.HashGetAsync(key, "expected_total");
                var succVal = await db.HashGetAsync(key, "succeeded");
                var failVal = await db.HashGetAsync(key, "failed");
                var toVal = await db.HashGetAsync(key, "timed_out");
                var finalEmitted = await db.HashGetAsync(key, "final_emitted");
                var processedCount = await db.HashGetAsync(key, "processed_count");
                var ttl = await db.KeyTimeToLiveAsync(key);
                jobs.Add(new {
                    jobId,
                    chains = chainsVal.ToString(),
                    status = statusVal.ToString(),
                    expected = (int)(long)(expectedVal.HasValue ? expectedVal : 0),
                    succeeded = (int)(long)(succVal.HasValue ? succVal : 0),
                    failed = (int)(long)(failVal.HasValue ? failVal : 0),
                    timedOut = (int)(long)(toVal.HasValue ? toVal : 0),
                    processed = (int)(long)(processedCount.HasValue ? processedCount : 0),
                    isFinal = finalEmitted == "1",
                    createdAt,
                    expiresInSeconds = ttl?.TotalSeconds,
                    active = finalEmitted != "1" && ttl.HasValue
                });
            }
            catch { }
        }
        jobs = jobs.OrderByDescending(j => (DateTime)j.GetType().GetProperty("createdAt")!.GetValue(j)!).Take(limit).ToList();
        return Ok(new { account = acctLower, count = jobs.Count, jobs });
    }

    private async Task<IActionResult> BuildSnapshotAsync(Guid jobId)
    {
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        if (!await db.KeyExistsAsync(metaKey)) return NotFound(new { error = "job not found" });

        var metaEntries = await db.HashGetAllAsync(metaKey);
        var meta = metaEntries.ToDictionary(x => x.Name.ToString(), x => x.Value.ToString());

        meta.TryGetValue("status", out var statusStr);
        meta.TryGetValue("expected_total", out var expectedStr);
        meta.TryGetValue("succeeded", out var succStr);
        meta.TryGetValue("failed", out var failStr);
        meta.TryGetValue("timed_out", out var toStr);
        meta.TryGetValue("final_emitted", out var finalStr);
        meta.TryGetValue("account", out var accountStr);
        meta.TryGetValue("chains", out var chainsStr);
        meta.TryGetValue("created_at", out var createdStr);
        meta.TryGetValue("processed_count", out var processedCountStr);

        DateTime? createdAt = null;
        if (!string.IsNullOrEmpty(createdStr) && DateTime.TryParse(createdStr, out var parsedCreated)) createdAt = parsedCreated;

        var expected = int.TryParse(expectedStr, out var e) ? e : 0;
        var succeeded = int.TryParse(succStr, out var s) ? s : 0;
        var failed = int.TryParse(failStr, out var f) ? f : 0;
        var timedOutRaw = int.TryParse(toStr, out var tRaw) ? tRaw : 0;
        var maxTimedOut = Math.Max(0, expected - succeeded - failed);
        var timedOut = Math.Min(timedOutRaw, maxTimedOut);
        var isCompleted = finalStr == "1";
        var processedCount = int.TryParse(processedCountStr, out var pc) ? pc : (succeeded + failed + timedOut);

        var pendingKey = RedisKeys.Pending(jobId);
        var pendingMembers = await db.SetMembersAsync(pendingKey);
        var pending = pendingMembers.Select(m => m.ToString()).OrderBy(x => x).ToList();

        var server = _redis.GetServer(_redis.GetEndPoints().First());
        var resultPrefix = RedisKeys.ResultPrefix(jobId);
        var pattern = resultPrefix + "*";
        var resultKeys = server.Keys(pattern: pattern).ToArray();
        var processed = new List<object>();
        foreach (var rk in resultKeys)
        {
            try
            {
                var raw = await db.StringGetAsync(rk);
                if (!raw.HasValue) continue;
                string keyStr = rk.ToString();
                string chainFromKey = "";
                var parts = keyStr.Split(':');
                if (parts.Length >= 6)
                {
                    chainFromKey = parts[^1];
                }
                IntegrationResult? data = null;
                try { data = JsonSerializer.Deserialize<IntegrationResult>(raw!, EnumJsonOptions); } catch { }
                if (data == null)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(raw.ToString());
                        var root = doc.RootElement;
                        var provider = root.TryGetProperty("provider", out var pEl) ? pEl.ToString() : "unknown";
                        var status = root.TryGetProperty("status", out var stEl) ? stEl.ToString() : "unknown";
                        var error = root.TryGetProperty("errorMessage", out var errEl) && errEl.ValueKind != JsonValueKind.Null ? errEl.ToString() : null;
                        string chainVal = chainFromKey;
                        if (string.IsNullOrEmpty(chainVal) && root.TryGetProperty("chains", out var chainsEl) && chainsEl.ValueKind == JsonValueKind.Array)
                        {
                            var first = chainsEl.EnumerateArray().FirstOrDefault();
                            if (first.ValueKind == JsonValueKind.String) chainVal = first.GetString() ?? chainVal;
                        }
                        processed.Add(new { provider, chain = chainVal, status, error });
                        continue;
                    }
                    catch { continue; }
                }
                var chainValue = !string.IsNullOrEmpty(chainFromKey) ? chainFromKey : (data.Chains.FirstOrDefault() ?? "");
                processed.Add(new { provider = data.Provider.ToString(), chain = chainValue, status = data.Status.ToString(), error = data.ErrorMessage });
            }
            catch { }
        }

        var summaryKey = RedisKeys.Summary(jobId);
        object? summaryObj = null;
        var summaryJson = await db.StringGetAsync(summaryKey);
        if (summaryJson.HasValue)
        {
            try { summaryObj = JsonSerializer.Deserialize<object>(summaryJson!, EnumJsonOptions); } catch { summaryObj = null; }
        }

        var consolidatedKey = RedisKeys.Wallet(jobId);
        List<object>? walletItems = null;
        var consolidatedJson = await db.StringGetAsync(consolidatedKey);
        if (consolidatedJson.HasValue)
        {
            try
            {
                using var doc = JsonDocument.Parse(consolidatedJson.ToString());
                var root = doc.RootElement;
                if (root.TryGetProperty("Items", out var itemsEl) || root.TryGetProperty("items", out itemsEl))
                {
                    walletItems = JsonSerializer.Deserialize<List<object>>(itemsEl.GetRawText());
                }
            }
            catch { walletItems = null; }
        }
        if (walletItems == null && isCompleted) walletItems = new List<object>();

        var progressNumerator = Math.Min(expected, succeeded + failed + timedOut);
        var progress = expected > 0 ? (double)progressNumerator / expected : 0d;

        return Ok(new
        {
            jobId,
            account = accountStr,
            chains = chainsStr,
            status = statusStr ?? AggregationStatus.Running.ToString(),
            expected,
            succeeded,
            failed,
            timedOut,
            pending,
            processed,
            processedCount,
            isCompleted,
            progress,
            jobStartedAt = createdAt,
            summary = summaryObj,
            items = walletItems,
            itemCount = walletItems?.Count ?? 0
        });
    }
}
