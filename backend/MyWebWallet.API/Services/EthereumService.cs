using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Mappers;
using System.Text.RegularExpressions;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services;

public class EthereumService : IBlockchainService
{
    private readonly IMoralisService _moralisService;
    private readonly IAaveeService _aaveeService;
    private readonly IUniswapV3Service _uniswapV3Service;
    private readonly IWalletItemMapperFactory _mapperFactory;
    private readonly IConfiguration _configuration;

    // Default to Base chain for now
    private const ChainEnum DEFAULT_CHAIN = ChainEnum.Base;

    public string NetworkName => "Ethereum";

    public EthereumService(
        IMoralisService moralisService,
        IConfiguration configuration,
        IAaveeService aaveeService,
        IUniswapV3Service uniswapV3Service,
        IWalletItemMapperFactory mapperFactory)
    {
        _moralisService = moralisService;
        _configuration = configuration;
        _aaveeService = aaveeService;
        _uniswapV3Service = uniswapV3Service;
        _mapperFactory = mapperFactory;
    }

    public bool IsValidAddress(string account)
    {
        return Regex.IsMatch(account, @"^0x[a-fA-F0-9]{40}$");
    }

    public async Task<WalletResponse> GetWalletTokensAsync(string account)
    {
        return await GetWalletTokensAsync(account, DEFAULT_CHAIN);
    }

    public async Task<WalletResponse> GetWalletTokensAsync(string account, ChainEnum chain)
    {
        if (!IsValidAddress(account))
        {
            throw new ArgumentException("Invalid Ethereum address");
        }

        try
        {
            var items = new List<WalletItem>();

            Console.WriteLine($"EthereumService: Starting wallet data fetch for account: {account} on chain: {chain}");

            // Validate chain support before proceeding
            ValidateChainSupport(chain);

            // Fetch data in parallel
            var fetchedData = await FetchAllDataAsync(account, chain);

            // Map data using strategies
            var mappingTasks = await MapAllDataAsync(fetchedData, chain);

            // Combine results
            foreach (var task in mappingTasks)
            {
                try
                {
                    var mappedItems = await task;
                    items.AddRange(mappedItems);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"WARNING: EthereumService: Mapping task failed: {ex.Message}");
                }
            }

            Console.WriteLine($"SUCCESS: EthereumService: All operations completed. Total items: {items.Count}");

            return new WalletResponse
            {
                Account = account,
                Items = items,
                Network = NetworkName,
                LastUpdated = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: Error fetching wallet data from {chain} chain: {ex.Message}");
            throw;
        }
    }

    private void ValidateChainSupport(ChainEnum chain)
    {
        var mappers = _mapperFactory.GetAllMappers();
        var supportedProtocols = mappers.Where(m => m.SupportsChain(chain)).ToList();
        
        Console.WriteLine($"DEBUG: EthereumService: Chain {chain} is supported by {supportedProtocols.Count} protocols: " +
                         $"{string.Join(", ", supportedProtocols.Select(p => p.GetProtocolName()))}");

        if (!supportedProtocols.Any())
        {
            throw new NotSupportedException($"Chain {chain} is not supported by any configured protocols");
        }
    }

    private async Task<(
        UniswapV3GetActivePoolsResponse? Uniswap,
        MoralisGetERC20TokenResponse? Tokens,
        AaveGetUserSuppliesResponse? AaveSupplies,
        AaveGetUserBorrowsResponse? AaveBorrows
    )> FetchAllDataAsync(string account, ChainEnum chain)
    {
        // Execute all independent API calls in parallel, but only for supported protocols
        var uniswapTask = SafeExecuteAsync(() => 
            _mapperFactory.CreateUniswapV3Mapper().SupportsChain(chain) 
                ? _uniswapV3Service.GetActivePoolsAsync(account) 
                : Task.FromResult<UniswapV3GetActivePoolsResponse?>(null), 
            "UniswapV3");

        var tokensTask = SafeExecuteAsync(() => 
            _mapperFactory.CreateMoralisTokenMapper().SupportsChain(chain)
                ? _moralisService.GetERC20TokenBalanceAsync(account, chain.ToChainId())
                : Task.FromResult<MoralisGetERC20TokenResponse?>(null), 
            "Moralis ERC20");

        var aaveSuppliesTask = SafeExecuteAsync(() => 
            _mapperFactory.CreateAaveSuppliesMapper().SupportsChain(chain)
                ? _aaveeService.GetUserSupplies(account, chain.ToChainId())
                : Task.FromResult<AaveGetUserSuppliesResponse?>(null), 
            "Aave Supplies");

        var aaveBorrowsTask = SafeExecuteAsync(() => 
            _mapperFactory.CreateAaveBorrowsMapper().SupportsChain(chain)
                ? _aaveeService.GetUserBorrows(account, chain.ToChainId())
                : Task.FromResult<AaveGetUserBorrowsResponse?>(null), 
            "Aave Borrows");

        // Wait for all API calls to complete
        await Task.WhenAll(uniswapTask, tokensTask, aaveSuppliesTask, aaveBorrowsTask);

        return (
            await uniswapTask,
            await tokensTask,
            await aaveSuppliesTask,
            await aaveBorrowsTask
        );
    }

    private async Task<List<Task<List<WalletItem>>>> MapAllDataAsync(
        (UniswapV3GetActivePoolsResponse? Uniswap,
         MoralisGetERC20TokenResponse? Tokens,
         AaveGetUserSuppliesResponse? AaveSupplies,
         AaveGetUserBorrowsResponse? AaveBorrows) data,
        ChainEnum chain)
    {
        var mappingTasks = new List<Task<List<WalletItem>>>();

        // Map UniswapV3 positions if data available and chain supported
        if (data.Uniswap != null)
        {
            var mapper = _mapperFactory.CreateUniswapV3Mapper();
            if (mapper.SupportsChain(chain))
            {
                mappingTasks.Add(mapper.MapAsync(data.Uniswap, chain));
            }
        }

        // Map Moralis tokens if data available and chain supported
        if (data.Tokens?.Result != null)
        {
            var mapper = _mapperFactory.CreateMoralisTokenMapper();
            if (mapper.SupportsChain(chain))
            {
                mappingTasks.Add(mapper.MapAsync(data.Tokens.Result, chain));
            }
        }

        // Map Aave supplies if data available and chain supported
        if (data.AaveSupplies != null)
        {
            var mapper = _mapperFactory.CreateAaveSuppliesMapper();
            if (mapper.SupportsChain(chain))
            {
                mappingTasks.Add(mapper.MapAsync(data.AaveSupplies, chain));
            }
        }

        // Map Aave borrows if data available and chain supported
        if (data.AaveBorrows != null)
        {
            var mapper = _mapperFactory.CreateAaveBorrowsMapper();
            if (mapper.SupportsChain(chain))
            {
                mappingTasks.Add(mapper.MapAsync(data.AaveBorrows, chain));
            }
        }

        return mappingTasks;
    }

    private async Task<T?> SafeExecuteAsync<T>(Func<Task<T?>> operation, string operationName)
    {
        try
        {
            var result = await operation();
            if (result != null)
            {
                Console.WriteLine($"SUCCESS: EthereumService: {operationName} data fetched successfully");
            }
            else
            {
                Console.WriteLine($"INFO: EthereumService: {operationName} skipped (chain not supported)");
            }
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: EthereumService: {operationName} data fetch failed, continuing without it: {ex.Message}");
            return default;
        }
    }
}