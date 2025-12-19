namespace DeFi10.API.Aggregation;

using ChainEnum = DeFi10.API.Models.Chain;
using System.Text.Json;

public static class RedisKeys
{
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    
    public static string SerializeAccounts(IEnumerable<string> accounts)
    {
        return JsonSerializer.Serialize(accounts, _jsonOptions);
    }
    
    public static List<string> DeserializeAccounts(string accountsStr)
    {
        if (string.IsNullOrWhiteSpace(accountsStr))
            return new List<string>();
            
        var trimmed = accountsStr.Trim();
        
        if (trimmed.StartsWith('['))
        {
            try
            {
                return JsonSerializer.Deserialize<List<string>>(trimmed, _jsonOptions) ?? new List<string>();
            }
            catch
            {
            }
        }
        
        return trimmed.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }
    
    public static List<ChainEnum> DeserializeChains(string chainsStr)
    {
        if (string.IsNullOrWhiteSpace(chainsStr))
            return new List<ChainEnum>();
            
        return chainsStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => Enum.Parse<ChainEnum>(s, ignoreCase: true))
            .ToList();
    }
    
    public static class MetaFields
    {
        public const string Accounts = "accounts";
        public const string Chains = "chains";
        public const string Status = "status";
        public const string ExpectedTotal = "expected_total";
        public const string Succeeded = "succeeded";
        public const string Failed = "failed";
        public const string TimedOut = "timed_out";
        public const string FinalEmitted = "final_emitted";
        public const string ProcessedCount = "processed_count";
        public const string WalletGroupId = "wallet_group_id";
        public const string CreatedAt = "created_at";
    }
    
    public static string ActiveJob(IEnumerable<string> accounts, IEnumerable<ChainEnum> chains)
    {
        var accountsPart = string.Join(",", accounts.Select(a => a.ToLowerInvariant()).OrderBy(a => a));
        var chainsPart = string.Join("+", chains.OrderBy(c => c.ToString()));
        var combined = $"{accountsPart}:{chainsPart}";
        
        using var md5 = System.Security.Cryptography.MD5.Create();
        var hash = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(combined));
        var hashStr = Convert.ToHexString(hash).ToLowerInvariant();
        
        return $"wallet:agg:active:{hashStr}";
    }
    
    public static string ActiveWalletGroup(Guid walletGroupId, IEnumerable<ChainEnum> chains) => $"wallet:agg:active:group:{walletGroupId}:{string.Join('+', chains.OrderBy(c => c.ToString()))}";
    public static string Meta(Guid jobId) => $"wallet:agg:{jobId}:meta";
    public static string Pending(Guid jobId) => $"wallet:agg:{jobId}:pending";
    public static string ResultPrefix(Guid jobId) => $"wallet:agg:{jobId}:result:"; 
    public static string Summary(Guid jobId) => $"wallet:agg:{jobId}:summary";
    public static string Durations(Guid jobId) => $"wallet:agg:{jobId}:durations";
    public static string Wallet(Guid jobId) => $"wallet:agg:{jobId}:wallet";
    public static string WalletForAccount(Guid jobId, string account) => $"wallet:agg:{jobId}:wallet:{account.ToLowerInvariant()}";
    public static string ConsolidationDone(Guid jobId) => $"wallet:agg:{jobId}:consolidation_done";
    public static string Index(string accountLower) => $"wallet:agg:index:{accountLower}";
    
    public static string DurationEntry(string provider, string chain, string? account = null)
    {
        var providerLower = provider.ToLowerInvariant();
        var chainLower = chain.ToLowerInvariant();
        return account != null
            ? $"{providerLower}:{chainLower}:{account.ToLowerInvariant()}"
            : $"{providerLower}:{chainLower}";
    }
    
    public static string Result(Guid jobId, string provider, ChainEnum chain, string? account = null)
    {
        var providerLower = provider.ToLowerInvariant();
        var chainLower = chain.ToString().ToLowerInvariant();
        return account != null
            ? $"wallet:agg:{jobId}:result:{providerLower}:{chainLower}:{account.ToLowerInvariant()}"
            : $"wallet:agg:{jobId}:result:{providerLower}:{chainLower}";
    }
    
    public static string WalletCache(string accountLower, ChainEnum chain, string provider) => $"wallet:cache:{accountLower}:{chain.ToString().ToLowerInvariant()}:{provider.ToLowerInvariant()}";
    public static string WalletCachePattern(string accountLower) => $"wallet:cache:{accountLower}:*";
}
