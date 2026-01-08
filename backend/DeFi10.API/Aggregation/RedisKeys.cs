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
        
        return $"{RedisKeyPrefixes.WalletAggPrefix}active:{hashStr}";
    }
    
    public static string ActiveWalletGroup(Guid walletGroupId, IEnumerable<ChainEnum> chains) =>
        $"{RedisKeyPrefixes.WalletAggPrefix}active:group:{walletGroupId}:{string.Join('+', chains.OrderBy(c => c.ToString()))}";

    public static string Meta(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:meta";
    public static string Pending(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:pending";
    public static string ResultPrefix(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:{RedisKeyPrefixes.ResultPrefixSuffix}"; 
    public static string Summary(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:summary";
    public static string Durations(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:durations";
    public static string Wallet(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:wallet";
    public static string WalletForAccount(Guid jobId, string account) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:wallet:{account.ToLowerInvariant()}";
    public static string ConsolidationDone(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:consolidation_done";
    public static string Done(Guid jobId) => $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:done";
    public static string Index(string accountLower) => $"{RedisKeyPrefixes.WalletAggPrefix}index:{accountLower}";
    
    public static string DurationEntry(string provider, string chain, string? account = null)
    {
        var providerLower = provider.ToLowerInvariant();
        var chainLower = chain.ToLowerInvariant();
        if (string.IsNullOrEmpty(account))
            return $"{providerLower}:{chainLower}";
        var accountLower = account.ToLowerInvariant();
        return $"{providerLower}:{chainLower}:{accountLower}";
    }
    
    public static string PendingEntry(string provider, string chain, string? account = null)
    {
        var providerLower = provider.ToLowerInvariant();
        var chainLower = chain.ToLowerInvariant();
        if (string.IsNullOrEmpty(account))
            return $"{providerLower}:{chainLower}";
        var accountLower = account.ToLowerInvariant();
        return $"{providerLower}:{chainLower}:{accountLower}";
    }
    
    public static string Result(Guid jobId, string provider, ChainEnum chain, string? account = null)
    {
        var providerLower = provider.ToLowerInvariant();
        var chainLower = chain.ToString().ToLowerInvariant();
        return account != null
            ? $"wallet:agg:{jobId}:result:{providerLower}:{chainLower}:{account.ToLowerInvariant()}"
            : $"wallet:agg:{jobId}:result:{providerLower}:{chainLower}";
    }
    
    public static string ResultLegacy(Guid jobId, string provider, ChainEnum chain, string? account = null)
    {
        var providerLower = provider.ToLowerInvariant();
        var chainLower = chain.ToString().ToLowerInvariant();
        return account != null
            ? $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:{RedisKeyPrefixes.ResultPrefixSuffix}{providerLower}:{chainLower}:{account.ToLowerInvariant()}"
            : $"{RedisKeyPrefixes.WalletAggPrefix}{jobId}:{RedisKeyPrefixes.ResultPrefixSuffix}{providerLower}:{chainLower}";
    }

    public static string WalletCache(string accountLower, ChainEnum chain, string provider) =>
        $"{RedisKeyPrefixes.WalletCachePrefix}{accountLower}:{chain.ToString().ToLowerInvariant()}:{provider.ToLowerInvariant()}";

    public static string WalletCachePattern(string accountLower) => $"{RedisKeyPrefixes.WalletCachePrefix}{accountLower}:*";
}
