using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Helpers;

namespace MyWebWallet.API.Services;

public class WalletService : IWalletService
{
    private readonly IEnumerable<IBlockchainService> _blockchainServices;
    private readonly ICacheService _cacheService;
    private readonly ITokenLogoService _tokenLogoService;
    
    public WalletService(
        IEnumerable<IBlockchainService> blockchainServices, 
        ICacheService cacheService,
        ITokenLogoService tokenLogoService)
    {
        _blockchainServices = blockchainServices;
        _cacheService = cacheService;
        _tokenLogoService = tokenLogoService;
    }

    public async Task<WalletResponse> GetWalletInfoAsync(string account)
    {
        return await GetWalletInfoAsync(account, Chain.Base); // Default to Base
    }

    public async Task<WalletResponse> GetWalletInfoAsync(string account, Chain chain)
    {
        // Check cache first
        var cacheKey = _cacheService.GenerateWalletCacheKey(account, chain);
        var cachedResult = await _cacheService.GetAsync<WalletResponse>(cacheKey);
        
        if (cachedResult != null)
        {
            Console.WriteLine($"SUCCESS: WalletService: Cache hit for account {account} on chain {chain}");
            return cachedResult;
        }

        Console.WriteLine($"DEBUG: WalletService: Cache miss for account {account} on chain {chain}, fetching from services");

        var blockchainService = _blockchainServices.FirstOrDefault(s => s.IsValidAddress(account));
        
        if (blockchainService == null)
            throw new ArgumentException("Invalid account address format");

        WalletResponse result;

        // Check if the service supports chain-specific calls
        if (blockchainService is EthereumService ethereumService)
        {
            result = await ethereumService.GetWalletTokensAsync(account, chain);
        }
        else
        {
            // Fallback to default method for other blockchain services
            result = await blockchainService.GetWalletTokensAsync(account);
        }

        // ?? BATCH TOKEN HYDRATION - Single operation for all tokens
        await HydrateTokenLogosInBatch(result.Items, chain);

        // Cache the successful result (after hydration)
        await _cacheService.SetAsync(cacheKey, result);
        Console.WriteLine($"SUCCESS: WalletService: Result cached for account {account} on chain {chain}");

        return result;
    }

    public async Task<WalletResponse> GetWalletInfoAsync(string account, IEnumerable<Chain> chains)
    {
        var chainList = chains.ToList();
        
        // Check cache first
        var cacheKey = _cacheService.GenerateWalletCacheKey(account, chainList);
        var cachedResult = await _cacheService.GetAsync<WalletResponse>(cacheKey);
        
        if (cachedResult != null)
        {
            Console.WriteLine($"SUCCESS: WalletService: Multi-chain cache hit for account {account} with {chainList.Count} chains");
            return cachedResult;
        }

        Console.WriteLine($"DEBUG: WalletService: Multi-chain cache miss for account {account}, fetching from services");

        var blockchainService = _blockchainServices.FirstOrDefault(s => s.IsValidAddress(account));
        
        if (blockchainService == null)
            throw new ArgumentException("Invalid account address format");

        if (blockchainService is not EthereumService ethereumService)
        {
            // Fallback to single chain for non-Ethereum services
            return await GetWalletInfoAsync(account);
        }

        if (!chainList.Any())
        {
            return await GetWalletInfoAsync(account);
        }

        Console.WriteLine($"WalletService: Processing {chainList.Count} chains for account: {account}");

        // Execute all chain requests in parallel
        var chainTasks = chainList.Select(async chain =>
        {
            try
            {
                Console.WriteLine($"WalletService: Starting chain {chain} processing...");
                var result = await ethereumService.GetWalletTokensAsync(account, chain);
                Console.WriteLine($"SUCCESS: WalletService: Chain {chain} completed with {result.Items.Count} items");
                return new ChainResult { Chain = chain, Response = result, Success = true, Error = null };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: WalletService: Chain {chain} failed: {ex.Message}");
                return new ChainResult { Chain = chain, Response = null, Success = false, Error = ex.Message };
            }
        });

        var chainResults = await Task.WhenAll(chainTasks);

        // Combine all successful results
        var combinedItems = new List<WalletItem>();
        var successfulChains = new List<string>();
        var failedChains = new List<object>();

        foreach (var result in chainResults)
        {
            if (result.Success && result.Response != null)
            {
                combinedItems.AddRange(result.Response.Items);
                successfulChains.Add(result.Chain.GetDisplayName());
            }
            else
            {
                failedChains.Add(new 
                { 
                    chain = result.Chain.GetDisplayName(), 
                    error = result.Error 
                });
            }
        }

        Console.WriteLine($"SUCCESS: WalletService: Multi-chain processing completed. " +
                         $"Successful chains: {successfulChains.Count}, Failed chains: {failedChains.Count}, Total items: {combinedItems.Count}");

        // ?? BATCH TOKEN HYDRATION - Process all chains together by grouping tokens
        var successfulResults = chainResults.Where(r => r.Success && r.Response != null).ToList();
        await HydrateTokenLogosForMultiChain(successfulResults);

        // Create combined response
        var networkName = chainList.Count == 1 
            ? chainList.First().GetDisplayName() 
            : $"Multi-Chain ({string.Join(", ", successfulChains)})";

        var finalResult = new WalletResponse
        {
            Account = account,
            Items = combinedItems,
            Network = networkName,
            LastUpdated = DateTime.UtcNow
        };

        // Cache the successful result
        await _cacheService.SetAsync(cacheKey, finalResult);
        Console.WriteLine($"SUCCESS: WalletService: Multi-chain result cached for account {account}");

        return finalResult;
    }

    private async Task HydrateTokenLogosInBatch(List<WalletItem> items, Chain chain)
    {
        if (!items.Any()) return;

        try
        {
            var hydrationHelper = new TokenHydrationHelper(_tokenLogoService);
            var tokenLogos = await hydrationHelper.HydrateTokenLogosAsync(items, chain);
            hydrationHelper.ApplyTokenLogosToWalletItems(items, tokenLogos);
            
            Console.WriteLine($"SUCCESS: WalletService: Batch hydrated tokens for chain {chain}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: WalletService: Failed to hydrate token logos for chain {chain}: {ex.Message}");
        }
    }

    private async Task HydrateTokenLogosForMultiChain(List<ChainResult> successfulChainResults)
    {
        // Group tokens by chain and hydrate each chain's tokens in batch
        var hydrationTasks = successfulChainResults.Select(async result =>
        {
            try
            {
                await HydrateTokenLogosInBatch(result.Response!.Items, result.Chain);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: WalletService: Failed to hydrate tokens for chain {result.Chain}: {ex.Message}");
            }
        });

        await Task.WhenAll(hydrationTasks);
        Console.WriteLine("SUCCESS: WalletService: Completed batch hydration for all chains");
    }

    private class ChainResult
    {
        public Chain Chain { get; set; }
        public WalletResponse? Response { get; set; }
        public bool Success { get; set; }
        public string? Error { get; set; }
    }
}