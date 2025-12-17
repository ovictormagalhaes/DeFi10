using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Results;
using System.Text.Json;
using System.Text.Json.Serialization;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Core;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Domain;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Aggregation; 
using System.Text.RegularExpressions;
using DeFi10.API.Controllers.Requests;
using Microsoft.AspNetCore.Authorization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace DeFi10.API.Controllers;

[ApiController]
[Route("api/v1/aggregations")] 
public class AggregationController : ControllerBase
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IWalletAggregationService _blockchainService;
    private readonly IChainConfigurationService _chainConfig;
    private readonly ILogger<AggregationController> _logger;

    private static readonly Regex EthAddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);
    private static readonly Regex SolAddressRegex = new("^[1-9A-HJ-NP-Za-km-z]{32,44}$", RegexOptions.Compiled);
    
    private static readonly JsonSerializerOptions EnumJsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly ChainEnum[] DefaultEthChains = new[] { ChainEnum.Base, ChainEnum.BNB, ChainEnum.Arbitrum, ChainEnum.Ethereum };
    private static readonly ChainEnum[] DefaultSolChains = new[] { ChainEnum.Solana };
    private const string MetaPattern = "wallet:agg:*:meta"; 

    public AggregationController(IConnectionMultiplexer redis, IWalletAggregationService blockchainService, IChainConfigurationService chainConfigurationService, ILogger<AggregationController> logger)
    {
        _redis = redis;
        _blockchainService = blockchainService;
        _chainConfig = chainConfigurationService;
        _logger = logger;
    }

    private static string ActiveJobKey(string accountLower, ChainEnum chain) => RedisKeys.ActiveSingle(accountLower, chain);

    private enum WalletType { Ethereum, Solana, Unknown }

    private static WalletType DetectWalletType(string address)
    {
        if (EthAddressRegex.IsMatch(address))
            return WalletType.Ethereum;
        if (SolAddressRegex.IsMatch(address))
            return WalletType.Solana;
        return WalletType.Unknown;
    }

    private static bool IsValidAddressForChain(string address, ChainEnum chain)
    {
        return chain switch
        {
            ChainEnum.Solana => SolAddressRegex.IsMatch(address),
            ChainEnum.Base or ChainEnum.Ethereum or ChainEnum.Arbitrum or ChainEnum.Optimism or ChainEnum.BNB or ChainEnum.Polygon => EthAddressRegex.IsMatch(address),
            _ => false
        };
    }

    [HttpPost]
    public async Task<IActionResult> Start([FromBody] AggregationStartRequest request)
    {
        if (request is null) return BadRequest(new { error = "payload required" });

        List<string> accounts;
        Guid? walletGroupId = null;
        
        if (!string.IsNullOrWhiteSpace(request.Account))
        {

            accounts = new List<string> { request.Account.Trim() };
        }
        else if (request.WalletGroupId.HasValue)
        {

            walletGroupId = request.WalletGroupId.Value;

            var walletGroupIdFromToken = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(walletGroupIdFromToken) || !Guid.TryParse(walletGroupIdFromToken, out var tokenWalletGroupId))
            {
                return Unauthorized(new { error = "Invalid or missing authentication token" });
            }

            if (tokenWalletGroupId != walletGroupId)
            {
                _logger.LogWarning("Wallet group ID mismatch: token={TokenId}, requested={RequestedId}", tokenWalletGroupId, walletGroupId);
                return Forbid();
            }

            var walletGroupService = HttpContext.RequestServices.GetRequiredService<IWalletGroupService>();
            var walletGroup = await walletGroupService.GetAsync(walletGroupId.Value);
            
            if (walletGroup == null)
            {
                return NotFound(new { error = $"Wallet group '{walletGroupId}' not found" });
            }
            
            accounts = walletGroup.Wallets;
            _logger.LogInformation("Resolved wallet group {GroupId} to {Count} accounts", walletGroupId, accounts.Count);
        }
        else
        {
            return BadRequest(new { error = "Either 'account' or 'walletGroupId' is required" });
        }

        var walletTypes = new HashSet<WalletType>();
        foreach (var acc in accounts)
        {
            var type = DetectWalletType(acc);
            if (type == WalletType.Unknown)
            {
                return BadRequest(new { error = $"Invalid address format for '{acc}'. Must be a valid Ethereum (0x...) or Solana (Base58) address." });
            }
            walletTypes.Add(type);
        }

        _logger.LogInformation("Detected wallet types: {Types} for {Count} address(es)", 
            string.Join(", ", walletTypes), accounts.Count);

        if (_blockchainService is not WalletAggregationService eth)
            return BadRequest(new { error = "Unsupported blockchain service for aggregation start" });

        try
        {
            var enabledChains = _chainConfig.GetEnabledChains().ToHashSet();
            var resolved = new List<ChainEnum>();
            var chains = request.Chains;
            if (chains != null && chains.Length > 0)
            {
                foreach (var entry in chains)
                {
                    if (string.IsNullOrWhiteSpace(entry)) continue;
                    foreach (var part in entry.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    {
                        if (Enum.TryParse<ChainEnum>(part, true, out var parsed))
                        {

                            bool anyCompatible = accounts.Any(acc => IsValidAddressForChain(acc, parsed));
                            
                            if (!anyCompatible)
                            {
                                return BadRequest(new { 
                                    error = $"None of the provided wallet addresses are compatible with chain '{parsed}'. " +
                                           $"Ethereum addresses (0x...) work with EVM chains (Base, Arbitrum, etc.). " +
                                           $"Solana addresses (Base58) work only with Solana chain."
                                });
                            }
                            
                            if (enabledChains.Contains(parsed) && !resolved.Contains(parsed))
                                resolved.Add(parsed);
                        }
                        else
                        {
                            return BadRequest(new { error = $"Invalid chain '{part}'" });
                        }
                    }
                }
            }
            
            if (resolved.Count == 0)
            {

                var hasEvm = accounts.Any(acc => DetectWalletType(acc) == WalletType.Ethereum);
                var hasSolana = accounts.Any(acc => DetectWalletType(acc) == WalletType.Solana);
                
                if (hasEvm)
                {
                    resolved.AddRange(DefaultEthChains.Where(enabledChains.Contains));
                }
                if (hasSolana)
                {
                    resolved.AddRange(DefaultSolChains.Where(enabledChains.Contains));
                }
                
                _logger.LogInformation("Auto-selected {Count} chains for mixed wallet types: {Chains}", 
                    resolved.Count, string.Join(", ", resolved));
            }

            resolved = resolved.Where(chain => accounts.Any(acc => IsValidAddressForChain(acc, chain))).Distinct().ToList();
            
            if (resolved.Count == 0) 
            {
                return BadRequest(new { 
                    error = "No compatible enabled chains available for the provided wallet addresses. " +
                           "Ensure at least one enabled chain matches your wallet type(s)."
                });
            }

            Guid jobId;
            if (accounts.Count == 1)
            {

                jobId = resolved.Count == 1
                    ? await eth.StartAsyncAggregation(accounts[0], resolved[0])
                    : await eth.StartAsyncAggregation(accounts[0], resolved);
            }
            else
            {

                jobId = await eth.StartAsyncAggregationMultiWallet(accounts, resolved, walletGroupId);
            }

            var reused = await DetermineReuseAsync(accounts[0], resolved, jobId);

            return Ok(new 
            { 
                accounts = accounts.Count == 1 ? null : (object?)accounts,
                account = accounts.Count == 1 ? accounts[0] : null,
                walletGroupId, 
                walletTypes = walletTypes.Select(t => t.ToString()).ToList(),
                chains = resolved.Select(c => c.ToString()).ToList(), 
                jobId, 
                reused 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start aggregation");
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
    public async Task<IActionResult> GetAggregation(Guid jobId)
    {
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        var walletGroupIdField = await db.HashGetAsync(metaKey, "wallet_group_id");
        
        if (walletGroupIdField.HasValue && Guid.TryParse(walletGroupIdField.ToString(), out var jobWalletGroupId))
        {
            var walletGroupIdFromToken = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(walletGroupIdFromToken) || !Guid.TryParse(walletGroupIdFromToken, out var tokenWalletGroupId))
            {
                return Unauthorized(new { error = "This aggregation belongs to a wallet group and requires authentication" });
            }

            if (tokenWalletGroupId != jobWalletGroupId)
            {
                _logger.LogWarning("Wallet group ID mismatch for job {JobId}: token={TokenId}, job={JobGroupId}", jobId, tokenWalletGroupId, jobWalletGroupId);
                return Forbid();
            }
        }
        
        return await BuildSnapshotAsync(jobId);
    }

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
        meta.TryGetValue("wallet_group_id", out var walletGroupIdStr);
        Guid? walletGroupId = null;
        if (!string.IsNullOrEmpty(walletGroupIdStr) && Guid.TryParse(walletGroupIdStr, out var parsedWalletGroupId))
            walletGroupId = parsedWalletGroupId;

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
                
                // Redis key format:
                // Single wallet: wallet:agg:{jobId}:result:{provider}:{chain}
                // Multi wallet:  wallet:agg:{jobId}:result:{provider}:{chain}:{account}
                // Chain is ALWAYS at parts[5], regardless of multi/single wallet
                if (parts.Length >= 6)
                {
                    chainFromKey = parts[5];  // ? Chain position (not last)
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
            walletGroupId,
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
