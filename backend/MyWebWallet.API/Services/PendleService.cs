using System.Numerics;
using System.Text.Json;
using System.Text.Json.Serialization;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;
using Nethereum.Web3;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.RPC.Eth.DTOs;
using Nethereum.JsonRpc.Client;
using Nethereum.Util;

namespace MyWebWallet.API.Services;

public class PendleService : IPendleService
{
    private readonly IConfiguration _config;
    private readonly ILogger<PendleService> _logger;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly HttpClient _httpClient;

    private const string FALLBACK_VE_CONTRACT = "0x4f30A9D41B80ecC5B94306AB4364951AE3170210";
    private const int PENDLE_DECIMALS = 18;
    private const string CONFIG_CONTRACT_KEY = "Pendle:VeContract";
    private const string PROTOCOL_ID = "pendle-v2";
    private const string PENDLE_API_BASE = "https://api-v2.pendle.finance/core";
    
    // Cache for PT tokens discovered from Pendle API
    private static List<PendlePTToken>? _cachedPTTokens = null;
    private static DateTime _cacheExpiry = DateTime.MinValue;
    private static readonly TimeSpan CACHE_DURATION = TimeSpan.FromHours(1);

    public PendleService(HttpClient httpClient, IConfiguration config, ILogger<PendleService> logger, IChainConfigurationService _unused, IProtocolConfigurationService protocolConfig)
    { 
        _httpClient = httpClient;
        _config = config; 
        _logger = logger; 
        _protocolConfig = protocolConfig; 
    }

    public async Task<PendleVePositionsResponse?> GetVePositionsAsync(string account, ChainEnum chain)
    {
        var resp = new PendleVePositionsResponse();
        if (chain != ChainEnum.Ethereum || string.IsNullOrWhiteSpace(account)) return resp;
        var addr = account.Trim();
        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(addr)) return resp;
        try { addr = AddressUtil.Current.ConvertToChecksumAddress(addr); } catch { }

        var contract = _config[CONFIG_CONTRACT_KEY];
        if (string.IsNullOrWhiteSpace(contract))
        {
            var proto = _protocolConfig.GetProtocolOnChain(PROTOCOL_ID, chain);
            if (proto?.Settings != null && proto.Settings.TryGetValue("veContract", out var cfgVe) && !string.IsNullOrWhiteSpace(cfgVe))
                contract = cfgVe.Trim();
        }
        if (string.IsNullOrWhiteSpace(contract)) contract = FALLBACK_VE_CONTRACT;

        var rpc = ResolveAlchemyOrOverride();
        if (rpc == null) { _logger.LogWarning("[Pendle] Missing RPC (Alchemy or override)"); return resp; }

        try
        {
            var web3 = new Web3(rpc);
            PositionDataOutput? pos = null;
            try
            {
                var handler = web3.Eth.GetContractQueryHandler<PositionDataFunction>();
                pos = await handler.QueryDeserializingToObjectAsync<PositionDataOutput>(new PositionDataFunction { User = addr }, contract, new BlockParameter());
            }
            catch (RpcResponseException ex) { _logger.LogDebug(ex, "[Pendle] positionData revert"); return resp; }
            catch (Exception ex) { _logger.LogDebug(ex, "[Pendle] positionData unexpected"); return resp; }

            if (pos == null || pos.Amount == 0 || pos.Expiry == 0) return resp;

            BigInteger veBalanceRaw = 0; BigInteger veSupplyRaw = 0;
            try { var balHandler = web3.Eth.GetContractQueryHandler<BalanceOfFunction>(); veBalanceRaw = await balHandler.QueryAsync<BigInteger>(contract, new BalanceOfFunction { User = addr }, null); } catch { }
            try { var supplyHandler = web3.Eth.GetContractQueryHandler<TotalSupplyStoredFunction>(); veSupplyRaw = await supplyHandler.QueryAsync<BigInteger>(contract, new TotalSupplyStoredFunction(), null); } catch { }

            var amountFormatted = Format(pos.Amount);
            var veBalanceFmt = Format(veBalanceRaw);
            var unlockTs = (long)Math.Min((double)pos.Expiry, long.MaxValue);

            string? votingSharePct = null;
            if (veBalanceRaw > 0 && veSupplyRaw > 0)
            { var pct = (double)veBalanceRaw / (double)veSupplyRaw * 100d; votingSharePct = pct.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture); }

            resp.Data.Locks.Add(new PendleVeLock
            {
                LockId = "vePendle",
                Amount = pos.Amount.ToString(),
                AmountFormatted = amountFormatted,
                UnlockTime = unlockTs,
                VeBalance = veBalanceFmt,
                Penalty = votingSharePct
            });
            return resp;
        }
        catch (Exception ex) { _logger.LogError(ex, "[Pendle] vePendle query error"); return resp; }
    }

    public async Task<PendleDepositsResponse?> GetDepositsAsync(string account, ChainEnum chain)
    {
        var resp = new PendleDepositsResponse();
        if (chain != ChainEnum.Base || string.IsNullOrWhiteSpace(account)) 
        {
            _logger.LogDebug("[Pendle] Skipping deposits query: chain={Chain} account={Account}", chain, account);
            return resp;
        }
        
        var addr = account.Trim();
        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(addr)) 
        {
            _logger.LogWarning("[Pendle] Invalid address format: {Address}", addr);
            return resp;
        }
        
        try { addr = AddressUtil.Current.ConvertToChecksumAddress(addr); } 
        catch (Exception ex) 
        { 
            _logger.LogWarning(ex, "[Pendle] Failed to convert address to checksum: {Address}", addr);
        }

        var rpc = ResolveBaseRpc();
        if (rpc == null) 
        { 
            _logger.LogWarning("[Pendle] Missing Base RPC (Alchemy or override)"); 
            return resp; 
        }

        _logger.LogInformation("[Pendle] ?? Starting deposits query: account={Account} on Base", addr);

        try
        {
            // Get PT tokens from Pendle API (with caching)
            var ptTokens = await GetPTTokensFromAPIAsync();
            
            if (ptTokens == null || ptTokens.Count == 0)
            {
                _logger.LogWarning("[Pendle] ?? No PT tokens discovered from Pendle API");
                return resp;
            }

            _logger.LogInformation("[Pendle] ?? Found {Count} PT tokens from Pendle API for Base chain", ptTokens.Count);

            var web3 = new Web3(rpc);

            foreach (var ptToken in ptTokens)
            {
                _logger.LogDebug("[Pendle] Checking PT token: {Symbol} at {Address}", ptToken.Symbol, ptToken.Address);
                
                try
                {
                    // Query ERC20 balanceOf for this PT token
                    var handler = web3.Eth.GetContractQueryHandler<ERC20BalanceOfFunction>();
                    var balance = await handler.QueryAsync<BigInteger>(
                        ptToken.Address, 
                        new ERC20BalanceOfFunction { Owner = addr }, 
                        null);

                    if (balance > 0)
                    {
                        var balanceFormatted = ConvertToDecimal(balance, ptToken.Decimals);
                        
                        _logger.LogInformation("[Pendle] ? Found PT token balance: {Symbol} = {Balance} (raw: {Raw})", 
                            ptToken.Symbol, balanceFormatted, balance);

                        resp.Data.Deposits.Add(new PendleDepositItem
                        {
                            MarketSymbol = ptToken.Symbol,
                            MaturityUnix = ptToken.Expiry,
                            PtAddress = ptToken.Address,
                            PtDecimals = ptToken.Decimals,
                            UnderlyingSymbol = ptToken.UnderlyingSymbol,
                            UnderlyingAddress = ptToken.UnderlyingAddress,
                            UnderlyingDecimals = ptToken.UnderlyingDecimals,
                            AmountRaw = balance,
                            AmountFormatted = balanceFormatted
                        });
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "[Pendle] Error checking PT token {Symbol}: {Message}", ptToken.Symbol, ex.Message);
                }
            }

            if (resp.Data.Deposits.Count > 0)
            {
                _logger.LogInformation("[Pendle] ? Successfully found {Count} PT token deposits for account={Account}", 
                    resp.Data.Deposits.Count, addr);
            }
            else
            {
                _logger.LogInformation("[Pendle] No PT token deposits found for account={Account} on Base", addr);
            }

            return resp;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Pendle] Fatal error in deposits query for account={Account}", addr);
            return resp;
        }
    }

    private async Task<List<PendlePTToken>?> GetPTTokensFromAPIAsync()
    {
        // Check cache first
        if (_cachedPTTokens != null && DateTime.UtcNow < _cacheExpiry)
        {
            _logger.LogDebug("[Pendle] Using cached PT tokens (expires in {Minutes} minutes)", 
                (_cacheExpiry - DateTime.UtcNow).TotalMinutes);
            return _cachedPTTokens;
        }

        try
        {
            // Base chain ID for Pendle API
            const string chainId = "8453"; // Base
            var url = $"{PENDLE_API_BASE}/v1/{chainId}/markets";
            
            _logger.LogInformation("[Pendle] ?? Fetching PT tokens from Pendle API: {Url}", url);

            var response = await _httpClient.GetAsync(url);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Pendle] Pendle API returned {StatusCode}", response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            var apiResponse = JsonSerializer.Deserialize<PendleMarketsResponse>(json, new JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true 
            });

            if (apiResponse?.Results == null || apiResponse.Results.Count == 0)
            {
                _logger.LogWarning("[Pendle] No markets returned from Pendle API");
                return null;
            }

            var ptTokens = new List<PendlePTToken>();

            foreach (var market in apiResponse.Results)
            {
                if (market.Pt?.Address == null || market.Pt?.Decimals == null)
                {
                    _logger.LogDebug("[Pendle] Skipping market {Address} - missing PT info", market.Address);
                    continue;
                }

                var ptToken = new PendlePTToken
                {
                    Address = market.Pt.Address,
                    Symbol = market.Pt.Symbol ?? $"PT-{market.UnderlyingAsset?.Symbol ?? "UNKNOWN"}",
                    Decimals = market.Pt.Decimals.Value,
                    Expiry = market.Expiry,
                    UnderlyingSymbol = market.UnderlyingAsset?.Symbol ?? "UNKNOWN",
                    UnderlyingAddress = market.UnderlyingAsset?.Address ?? string.Empty,
                    UnderlyingDecimals = market.UnderlyingAsset?.Decimals ?? 18,
                    MarketAddress = market.Address
                };

                ptTokens.Add(ptToken);
                _logger.LogDebug("[Pendle] Discovered PT: {Symbol} ({Address}) expires {Expiry}", 
                    ptToken.Symbol, ptToken.Address, DateTimeOffset.FromUnixTimeSeconds(ptToken.Expiry ?? 0));
            }

            _logger.LogInformation("[Pendle] ? Successfully discovered {Count} PT tokens from Pendle API", ptTokens.Count);

            // Update cache
            _cachedPTTokens = ptTokens;
            _cacheExpiry = DateTime.UtcNow.Add(CACHE_DURATION);

            return ptTokens;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Pendle] Error fetching PT tokens from Pendle API");
            return null;
        }
    }

    private string? ResolveAlchemyOrOverride()
    { 
        var ov = _config["Pendle:RpcOverride"]; 
        if (!string.IsNullOrWhiteSpace(ov)) return ov.Trim(); 
        
        var ak = _config["Alchemy:ApiKey"] ?? _config["ALCHEMY_API_KEY"] ?? _config["ALCHEMY_ETH_API_KEY"]; 
        if (!string.IsNullOrWhiteSpace(ak)) return $"https://eth-mainnet.g.alchemy.com/v2/{ak.Trim()}"; 
        
        return null; 
    }

    private string? ResolveBaseRpc()
    { 
        var ak = _config["Alchemy:ApiKey"] ?? _config["ALCHEMY_API_KEY"] ?? _config["ALCHEMY_BASE_API_KEY"]; 
        if (!string.IsNullOrWhiteSpace(ak)) return $"https://base-mainnet.g.alchemy.com/v2/{ak.Trim()}";
        
        var ov = _config["Alchemy:BaseRpcUrl"]; 
        if (!string.IsNullOrWhiteSpace(ov)) return ov;
        
        return null; 
    }

    private static string Format(BigInteger raw) => ConvertToDecimal(raw, PENDLE_DECIMALS).ToString(System.Globalization.CultureInfo.InvariantCulture);
    
    private static decimal ConvertToDecimal(BigInteger raw, int decimals)
    { 
        if (raw == 0) return 0m; 
        if (decimals <= 0) return (decimal)raw; 
        var div = BigInteger.Pow(10, decimals); 
        var integer = raw / div; 
        var rem = raw % div; 
        double v = (double)integer; 
        if (rem != 0) v += (double)rem / (double)div; 
        return (decimal)v; 
    }

    // Contract function definitions
    [Function("positionData", typeof(PositionDataOutput))]
    public class PositionDataFunction : FunctionMessage 
    { 
        [Parameter("address", "", 1)] 
        public string User { get; set; } = string.Empty; 
    }
    
    [FunctionOutput]
    public class PositionDataOutput : IFunctionOutputDTO 
    { 
        [Parameter("uint128", "amount", 1)] 
        public BigInteger Amount { get; set; } 
        
        [Parameter("uint128", "expiry", 2)] 
        public BigInteger Expiry { get; set; } 
    }
    
    [Function("balanceOf", "uint128")]
    public class BalanceOfFunction : FunctionMessage 
    { 
        [Parameter("address", "user", 1)] 
        public string User { get; set; } = string.Empty; 
    }
    
    [Function("totalSupplyStored", "uint128")]
    public class TotalSupplyStoredFunction : FunctionMessage { }
    
    // ERC20 standard functions for PT tokens
    [Function("balanceOf", "uint256")]
    public class ERC20BalanceOfFunction : FunctionMessage 
    { 
        [Parameter("address", "owner", 1)] 
        public string Owner { get; set; } = string.Empty; 
    }
    
    [Function("name", "string")]
    public class ERC20NameFunction : FunctionMessage { }

    // Models for Pendle API
    private class PendleMarketsResponse
    {
        public List<PendleMarket> Results { get; set; } = new();
        public int Total { get; set; }
        public int Limit { get; set; }
        public int Skip { get; set; }
    }

    private class PendleMarket
    {
        public string Address { get; set; } = string.Empty;
        
        // Pendle API returns expiry as string, not number
        [JsonPropertyName("expiry")]
        public string? ExpiryString { get; set; }
        
        [JsonIgnore]
        public long? Expiry => long.TryParse(ExpiryString, out var exp) ? exp : null;
        
        public PendleToken? Pt { get; set; }
        public PendleToken? Sy { get; set; }
        public PendleToken? Yt { get; set; }
        public PendleToken? UnderlyingAsset { get; set; }
    }

    private class PendleToken
    {
        public string? Address { get; set; }
        public string? Symbol { get; set; }
        public int? Decimals { get; set; }
        public string? Name { get; set; }
    }

    private class PendlePTToken
    {
        public string Address { get; set; } = string.Empty;
        public string Symbol { get; set; } = string.Empty;
        public int Decimals { get; set; }
        public long? Expiry { get; set; }
        public string UnderlyingSymbol { get; set; } = string.Empty;
        public string UnderlyingAddress { get; set; } = string.Empty;
        public int UnderlyingDecimals { get; set; }
        public string MarketAddress { get; set; } = string.Empty;
    }
}
