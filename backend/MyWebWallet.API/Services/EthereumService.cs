using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Mappers;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Numerics;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services;

public class EthereumService : IBlockchainService
{
    private readonly IMoralisService _moralisService;
    private readonly IAaveeService _aaveeService;
    private readonly IUniswapV3Service _uniswapV3Service; // kept for DI compatibility (not used)
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;
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
        IUniswapV3OnChainService uniswapV3OnChainService,
        IWalletItemMapperFactory mapperFactory)
    {
        _moralisService = moralisService;
        _configuration = configuration;
        _aaveeService = aaveeService;
        _uniswapV3Service = uniswapV3Service; // intentionally unused (subgraph disabled)
        _uniswapV3OnChainService = uniswapV3OnChainService;
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
        var supportedProtocols = _mapperFactory.GetAllMappers().Where(m => m.SupportsChain(chain)).ToList();
        if (!supportedProtocols.Any())
            throw new NotSupportedException($"Chain {chain} is not supported by any configured protocols");
    }

    private async Task<(
        UniswapV3GetActivePoolsResponse? Uniswap,
        UniswapV3GetActivePoolsResponse? UniswapOnChain,
        MoralisGetERC20TokenResponse? Tokens,
        AaveGetUserSuppliesResponse? AaveSupplies,
        AaveGetUserBorrowsResponse? AaveBorrows
    )> FetchAllDataAsync(string account, ChainEnum chain)
    {
        // Subgraph disabled: keep a placeholder null task
        var uniswapTask = Task.FromResult<UniswapV3GetActivePoolsResponse?>(null);
        Console.WriteLine("INFO: EthereumService: UniswapV3 (subgraph) disabled. Using on-chain only.");

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

        // Only open pools/positions option (true to hide closed positions)
        var onlyOpen = true;

        // On-chain Uniswap directly from owner as parallel task
        var uniswapOnChainTask = SafeExecuteAsync(() =>
            _uniswapV3OnChainService.GetActivePoolsOnChainAsync(account, onlyOpen),
            "Uniswap On-Chain");

        await Task.WhenAll(uniswapTask, tokensTask, aaveSuppliesTask, aaveBorrowsTask, uniswapOnChainTask);

        return (
            await uniswapTask,
            await uniswapOnChainTask,
            await tokensTask,
            await aaveSuppliesTask,
            await aaveBorrowsTask
        );
    }

    private async Task<List<Task<List<WalletItem>>>> MapAllDataAsync(
        (UniswapV3GetActivePoolsResponse? Uniswap,
         UniswapV3GetActivePoolsResponse? UniswapOnChain,
         MoralisGetERC20TokenResponse? Tokens,
         AaveGetUserSuppliesResponse? AaveSupplies,
         AaveGetUserBorrowsResponse? AaveBorrows) data,
        ChainEnum chain)
    {
        var mappingTasks = new List<Task<List<WalletItem>>>();

        // Subgraph mapping removed (disabled)

        // Map on-chain Uniswap positions if data available and chain supported
        if (data.UniswapOnChain != null)
        {
            var mapper = _mapperFactory.CreateUniswapV3Mapper();
            if (mapper.SupportsChain(chain))
            {
                mappingTasks.Add(mapper.MapAsync(data.UniswapOnChain, chain));
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
            Console.WriteLine(result != null
                ? $"SUCCESS: EthereumService: {operationName} data fetched successfully"
                : $"INFO: EthereumService: {operationName} skipped (chain not supported)");
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: EthereumService: {operationName} data fetch failed, continuing without it: {ex.Message}");
            return default;
        }
    }
}