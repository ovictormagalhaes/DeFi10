using System.Numerics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Pendle.Models;
using ChainEnum = DeFi10.API.Models.Chain;
using Nethereum.Web3;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.RPC.Eth.DTOs;
using Nethereum.JsonRpc.Client;
using Nethereum.Util;

namespace DeFi10.API.Services.Protocols.Pendle;

public class PendleService : IPendleService
{
    private readonly PendleOptions _pendleOptions;
    private readonly AlchemyOptions _alchemyOptions;
    private readonly ILogger<PendleService> _logger;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly HttpClient _httpClient;

    private const string FALLBACK_VE_CONTRACT = "0x4f30A9D41B80ecC5B94306AB4364951AE3170210";
    private const int PENDLE_DECIMALS = 18;
    private const string PENDLE_API_BASE = "https://api-v2.pendle.finance/core";
    
    private static List<PendlePTToken>? _cachedPTTokens = null;
    private static DateTime _cacheExpiry = DateTime.MinValue;
    private static readonly TimeSpan CACHE_DURATION = TimeSpan.FromHours(1);

    public PendleService(
        HttpClient httpClient,
        IOptions<PendleOptions> pendleOptions,
        IOptions<AlchemyOptions> alchemyOptions,
        ILogger<PendleService> logger,
        IChainConfigurationService _unused,
        IProtocolConfigurationService protocolConfig)
    { 
        _httpClient = httpClient;
        _pendleOptions = pendleOptions.Value;
        _alchemyOptions = alchemyOptions.Value;
        _logger = logger; 
        _protocolConfig = protocolConfig; 
    }

    public async Task<PendleVePositionsResponse?> GetVePositionsAsync(string account, ChainEnum chain)
    {
        var protocolDef = _protocolConfig.GetProtocol(ProtocolNames.PendleV2) ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.PendleV2}");
        var chainConfig = _protocolConfig.GetProtocolOnChain(protocolDef.Key!, ChainEnum.Ethereum);
        var resp = new PendleVePositionsResponse();
        if (chain != ChainEnum.Ethereum || string.IsNullOrWhiteSpace(account)) return resp;
        var addr = account.Trim();
        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(addr)) return resp;
        try { addr = AddressUtil.Current.ConvertToChecksumAddress(addr); } catch { }

        var contract = _pendleOptions.VeContract;
        if (string.IsNullOrWhiteSpace(contract))
        {
            var proto = _protocolConfig.GetProtocolOnChain(protocolDef.Key!, chain);
            if (proto?.Options != null && proto.Options.TryGetValue("veContract", out var cfgVe) && !string.IsNullOrWhiteSpace(cfgVe))
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

        _logger.LogDebug("[Pendle] Starting deposits query: account={Account} on Base", addr);

        try
        {
            var ptTokens = await GetPTTokensFromAPIAsync();
            
            if (ptTokens == null || ptTokens.Count == 0)
            {
                _logger.LogWarning("[Pendle] ?? No PT tokens discovered from Pendle API");
                return resp;
            }

            _logger.LogDebug("[Pendle] Found {Count} PT tokens from Pendle API for Base chain", ptTokens.Count);

            var web3 = new Web3(rpc);

            foreach (var ptToken in ptTokens)
            {
                _logger.LogDebug("[Pendle] Checking PT token: {Symbol} at {Address}", ptToken.Symbol, ptToken.Address);
                
                try
                {
                    var handler = web3.Eth.GetContractQueryHandler<ERC20BalanceOfFunction>();
                    var balance = await handler.QueryAsync<BigInteger>(
                        ptToken.Address, 
                        new ERC20BalanceOfFunction { Owner = addr }, 
                        null);

                    if (balance > 0)
                    {
                        var balanceFormatted = ConvertToDecimal(balance, ptToken.Decimals);
                        
                        _logger.LogDebug("[Pendle] Found PT token balance: {Symbol} = {Balance} (raw: {Raw})", 
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
                _logger.LogDebug("[Pendle] Successfully found {Count} PT token deposits for account={Account}", 
                    resp.Data.Deposits.Count, addr);
            }
            else
            {
                _logger.LogDebug("[Pendle] No PT token deposits found for account={Account} on Base", addr);
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
        if (_cachedPTTokens != null && DateTime.UtcNow < _cacheExpiry)
        {
            _logger.LogDebug("[Pendle] Using cached PT tokens (expires in {Minutes} minutes)", 
                (_cacheExpiry - DateTime.UtcNow).TotalMinutes);
            return _cachedPTTokens;
        }

        try
        {
            const string chainId = "8453";
            var url = $"{PENDLE_API_BASE}/v1/{chainId}/markets";
            
            _logger.LogDebug("[Pendle] Fetching PT tokens from Pendle API: {Url}", url);

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
        if (!string.IsNullOrWhiteSpace(_pendleOptions.RpcOverride)) 
            return _pendleOptions.RpcOverride.Trim(); 
        
        if (!string.IsNullOrWhiteSpace(_alchemyOptions.ApiKey)) 
            return $"https://eth-mainnet.g.alchemy.com/v2/{_alchemyOptions.ApiKey.Trim()}"; 
        
        return null; 
    }

    private string? ResolveBaseRpc()
    { 
        return _alchemyOptions.GetBaseRpcUrl();
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
