using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using System.Text.RegularExpressions;
using System.Numerics;

namespace MyWebWallet.API.Services;

public class EthereumService : IBlockchainService
{
    private readonly IMoralisService _moralisService;
    private readonly IAaveeService _aaveeService;
    private readonly IUniswapV3Service _uniswapV3Service;
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;
    private readonly IAlchemyNftService _alchemyNftService;
    private readonly IConfiguration _configuration;

    public string NetworkName => "Ethereum";

    public EthereumService(IMoralisService moralisService, IConfiguration configuration, IAaveeService aaveeService, IUniswapV3Service uniswapV3Service, IUniswapV3OnChainService uniswapV3OnChainService, IAlchemyNftService alchemyNftService)
    {
        _moralisService = moralisService;
        _configuration = configuration;
        _aaveeService = aaveeService;
        _uniswapV3Service = uniswapV3Service;
        _uniswapV3OnChainService = uniswapV3OnChainService;
        _alchemyNftService = alchemyNftService;
    }

    public bool IsValidAddress(string account)
    {
        return Regex.IsMatch(account, @"^0x[a-fA-F0-9]{40}$");
    }

    public async Task<WalletResponse> GetWalletTokensAsync(string account)
    {
        if (!IsValidAddress(account))
        {
            throw new ArgumentException("Invalid Ethereum address");
        }

        try
        {
            var baseChainId = "base";
            var items = new List<WalletItem>();

            Console.WriteLine($"EthereumService: Starting wallet data fetch for account: {account}");

            // Execute all independent API calls in parallel
            var uniswapV3PositionsTask = _uniswapV3Service.GetActivePoolsAsync(account);
            var tokensTask = _moralisService.GetERC20TokenBalanceAsync(account, baseChainId);
            var aaveSuppliesTask = _aaveeService.GetUserSupplies(account, baseChainId);
            var aaveBorrowsTask = _aaveeService.GetUserBorrows(account, baseChainId);

            // Wait for all API calls to complete
            await Task.WhenAll(uniswapV3PositionsTask, tokensTask, aaveSuppliesTask, aaveBorrowsTask);

            // Get results with error handling
            UniswapV3GetActivePoolsResponse? uniswapV3Positions = null;
            try
            {
                uniswapV3Positions = await uniswapV3PositionsTask;
                Console.WriteLine("SUCCESS: EthereumService: UniswapV3 data fetched successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: EthereumService: UniswapV3 data fetch failed, continuing without it: {ex.Message}");
            }

            MoralisGetERC20TokenResponse? tokens = null;
            try
            {
                tokens = await tokensTask;
                Console.WriteLine("SUCCESS: EthereumService: Moralis ERC20 tokens fetched successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: EthereumService: Moralis tokens fetch failed, continuing without it: {ex.Message}");
            }

            AaveGetUserSuppliesResponse? aaveSupplies = null;
            try
            {
                aaveSupplies = await aaveSuppliesTask;
                Console.WriteLine("SUCCESS: EthereumService: Aave supplies fetched successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: EthereumService: Aave supplies fetch failed, continuing without it: {ex.Message}");
            }

            AaveGetUserBorrowsResponse? aaveBorrows = null;
            try
            {
                aaveBorrows = await aaveBorrowsTask;
                Console.WriteLine("SUCCESS: EthereumService: Aave borrows fetched successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: EthereumService: Aave borrows fetch failed, continuing without it: {ex.Message}");
            }

            // Process results in parallel where possible (no external API calls)
            var uniswapMappingTask = MapUniswapV3PositionsAsync(uniswapV3Positions, baseChainId);
            var tokensMappingTask = Task.FromResult(MapTokens(tokens?.Result ?? [], baseChainId));
            var aaveSuppliesMappingTask = Task.FromResult(MapAaveUserSupplies(aaveSupplies, baseChainId));
            var aaveBorrowsMappingTask = Task.FromResult(MapAaveUserBorrow(aaveBorrows, baseChainId));

            await Task.WhenAll(uniswapMappingTask, tokensMappingTask, aaveSuppliesMappingTask, aaveBorrowsMappingTask);

            items.AddRange(await uniswapMappingTask);
            items.AddRange(await tokensMappingTask);
            items.AddRange(await aaveSuppliesMappingTask);
            items.AddRange(await aaveBorrowsMappingTask);

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
            Console.WriteLine($"ERROR: Error fetching wallet data from Base chain: {ex.Message}");
            throw;
        }
    }

    private List<WalletItem> MapTokens(IEnumerable<TokenDetail> items, string chain)
    {
        return items?.Select(token =>
        {
            decimal.TryParse(token.Balance, out var balance);

            var decimals = token.Decimals ?? 1;
            var balanceFormatted = balance / (decimal)Math.Pow(10, token.Decimals ?? 1);
            return new WalletItem()
            {
                Type = WalletItemType.Wallet,
                Token = new Token
                {
                    Name = token.Name,
                    Chain = chain,
                    Symbol = token.Symbol,
                    ContractAddress = token.TokenAddress,
                    Logo = string.IsNullOrEmpty(token.Logo) ? token.Thumbnail : token.Logo,
                    Thumbnail = token.Thumbnail,
                    Financials = new TokenFinancials
                    {
                        Amount = balance,
                        DecimalPlaces = decimals,
                        BalanceFormatted = balanceFormatted,
                        Price = (decimal?)token.UsdPrice,
                        TotalPrice = (decimal?)token.UsdPrice * balanceFormatted
                    },
                    Native = token.VerifiedContract ? false : (bool?)null,
                    PossibleSpam = token.PossibleSpam
                }
            };
        })?.ToList() ?? [];
    }

    private List<WalletItem> MapDeFiPositions(IEnumerable<GetDeFiPositionsMoralisInfo> items, string chain)
    {
        return items?.Select(d =>
        {
            var label = d.Position?.Label?.ToLowerInvariant();

            var walletItemType = label switch
            {
                "liquidity" => WalletItemType.LiquidityPool,
                "supplied" or "borrowed" => WalletItemType.LendingAndBorrowing,
                "staking" => WalletItemType.Staking,
                _ => WalletItemType.Other,
            };

            return new WalletItem
            {
                Type = walletItemType,
                Protocol = new Protocol
                {
                    Name = d.ProtocolName,
                    Chain = chain,
                    Id = d.ProtocolId,
                    Url = d.ProtocolUrl,
                    Logo = d.ProtocolLogo
                },
                Position = new Position
                {
                    Label = d.Position.Label,
                    Tokens = d.Position.Tokens.Select(t =>
                    {
                        var balance = t.Balance != null ? decimal.Parse(t.Balance) : 0;
                        var decimalPlaces = int.TryParse(t.Decimals, out var decimals) ? decimals : 0;
                        var balanceFormatted = balance / (decimal)Math.Pow(10, decimalPlaces);

                        return new Token
                        {
                            Type = ParseTokenType(t.TokenType),
                            Name = t.Name,
                            Symbol = t.Symbol,
                            ContractAddress = t.ContractAddress,
                            Logo = t.Logo,
                            Thumbnail = t.Thumbnail,
                            Financials = new TokenFinancials
                            {
                                Amount = balance,
                                DecimalPlaces = decimalPlaces,
                                BalanceFormatted = balanceFormatted,
                                Price = t.UsdPrice,
                                TotalPrice = t.UsdValue
                            }
                        };
                    }).ToList()
                },
                AdditionalData = new AdditionalData
                {
                    //HealthFactor = d.AccountData?.HealthFactory != null && decimal.TryParse(d.AccountData.HealthFactory, out var healthFactor) ? healthFactor : null
                }
            };
        })?.ToList() ?? [];
    }

    private List<WalletItem> MapAaveUserSupplies(AaveGetUserSuppliesResponse response, string chain)
    {
        return response?.Data?.UserBorrows?.Select(supply => new WalletItem
        {
            Type = WalletItemType.LendingAndBorrowing,
            Protocol = GetAaveProtocol(chain),
            Token = new Token
            {
                Name = supply.Currency.Name,
                Symbol = supply.Currency.Symbol,
                Financials = new TokenFinancials
                {
                    Amount = decimal.Parse(supply.Balance.Amount.Value),
                    BalanceFormatted = decimal.Parse(supply.Balance.Amount.Value),
                    Price = decimal.Parse(supply.Balance.Usd) / decimal.Parse(supply.Balance.Amount.Value),
                    TotalPrice = decimal.Parse(supply.Balance.Usd)
                }
            },
            Position = new Position
            {
                Label = "Supplied",
                Tokens = new List<Token>
                {
                    new Token
                    {
                        Type = TokenType.Supplied,
                        Name = supply.Currency.Name,
                        Symbol = supply.Currency.Symbol,
                        Financials = new TokenFinancials
                        {
                            Amount = decimal.Parse(supply.Balance.Amount.Value),
                            BalanceFormatted = decimal.Parse(supply.Balance.Amount.Value),
                            Price = decimal.Parse(supply.Balance.Usd) / decimal.Parse(supply.Balance.Amount.Value),
                            TotalPrice = decimal.Parse(supply.Balance.Usd)
                        }
                    }
                }
            },
            AdditionalData = new AdditionalData
            {
                IsCollateral = supply.IsCollateral,
                CanBeCollateral = supply.CanBeCollateral
            }
        }).ToList() ?? [];
    }

    private List<WalletItem> MapAaveUserBorrow(AaveGetUserBorrowsResponse response, string chain)
    {
        return response?.Data?.UserBorrows?.Select(supply =>
        {
            decimal.TryParse(supply.Debt.Amount.Value, out var balance);
            decimal.TryParse(supply.Debt.Usd, out var totalPrice);
            var price = balance > 0 ? totalPrice / balance : 0;

            return new WalletItem
            {
                Type = WalletItemType.LendingAndBorrowing,
                Protocol = GetAaveProtocol(chain),
                Token = new Token
                {
                    Type = TokenType.Borrowed,
                    Name = supply.Currency.Name,
                    Symbol = supply.Currency.Symbol,
                    Financials = new TokenFinancials
                    {
                        Amount = balance,
                        BalanceFormatted = balance,
                        Price = price,
                        TotalPrice = totalPrice
                    }
                },
                Position = new Position
                {
                    Label = "Borrowed",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Name = supply.Currency.Name,
                            Symbol = supply.Currency.Symbol,
                            Financials = new TokenFinancials
                            {
                                Amount = balance,
                                BalanceFormatted = balance,
                                Price = price,
                                TotalPrice = totalPrice
                            }
                        }
                    }
                },
                AdditionalData = new AdditionalData()
            };
        }).ToList() ?? new List<WalletItem>();
    }

    private async Task<List<WalletItem>> MapUniswapV3PositionsAsync(UniswapV3GetActivePoolsResponse response, string chain)
    {
        if (response?.Data?.Positions == null) return new List<WalletItem>();

        decimal.TryParse(response.Data.Bundles?.FirstOrDefault()?.NativePriceUSD, out var nativePriceUSD);

        var walletItems = new List<WalletItem>();

        // Process positions sequentially to avoid overwhelming blockchain RPC with parallel requests
        foreach (var position in response.Data.Positions)
        {
            await Task.Delay(1000);
            int.TryParse(position.Token0.Decimals, out var token0Decimals);
            int.TryParse(position.Token1.Decimals, out var token1Decimals);

            decimal.TryParse(position.DepositedToken0, out var depositedToken0);
            decimal.TryParse(position.WithdrawnToken0, out var withdrawnToken0);
            decimal.TryParse(position.DepositedToken1, out var depositedToken1);
            decimal.TryParse(position.WithdrawnToken1, out var withdrawnToken1);

            var currentSupplyToken0 = depositedToken0 - withdrawnToken0;
            var currentSupplyToken1 = depositedToken1 - withdrawnToken1;

            decimal.TryParse(position.Token0.DerivedNative, out var token0DerivedNative);
            decimal.TryParse(position.Token1.DerivedNative, out var token1DerivedNative);
            
            var token0PriceUSD = nativePriceUSD * token0DerivedNative;
            var token1PriceUSD = nativePriceUSD * token1DerivedNative;

            var positionToken0ValueUSD = currentSupplyToken0 * token0PriceUSD;
            var positionToken1ValueUSD = currentSupplyToken1 * token1PriceUSD;
            var totalPositionValueUSD = positionToken0ValueUSD + positionToken1ValueUSD;

            if (!BigInteger.TryParse(position.Id, out var tokenId)) continue;

            // Execute blockchain calls in parallel using Task.WhenAll
            var chainInformationTask = _uniswapV3OnChainService.GetPositionAsync(tokenId);
            var poolFeeGrowthTask = _uniswapV3OnChainService.GetPoolFeeGrowthAsync(position.Pool.Id);
            var currentTickTask = _uniswapV3OnChainService.GetCurrentTickAsync(position.Pool.Id);
            var tickRangeInfoTask = _uniswapV3OnChainService.GetTickRangeInfoAsync(
                position.Pool.Id, (int)position.TickLower, (int)position.TickUpper);

            // Wait for all blockchain calls to complete
            await Task.WhenAll(chainInformationTask, poolFeeGrowthTask, currentTickTask, tickRangeInfoTask);

            // Get the results
            var chainInformation = await chainInformationTask;
            var (feeGrowthGlobal0X128, feeGrowthGlobal1X128) = await poolFeeGrowthTask;
            var currentTick = await currentTickTask;
            var (lowerTickInfo, upperTickInfo) = await tickRangeInfoTask;

            var uncollectedFees = new UncollectedFees().CalculateUncollectedFees(
                chainInformation, 
                feeGrowthGlobal0X128, 
                feeGrowthGlobal1X128, 
                token0Decimals, 
                token1Decimals,
                currentTick,
                lowerTickInfo,
                upperTickInfo);

            var walletItem = new WalletItem
            {
                Type = WalletItemType.LiquidityPool,
                Protocol = GetUniswapV3Protocol(chain),
                Position = new Position
                {
                    Label = "Liquidity Pool",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Type = TokenType.Supplied,
                            Name = position.Token0.Name,
                            Symbol = position.Token0.Symbol,
                            ContractAddress = position.Token0.Id,
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token0Decimals,
                                Amount = currentSupplyToken0 * (decimal)Math.Pow(10, token0Decimals),
                                BalanceFormatted = currentSupplyToken0,
                                Price = token0PriceUSD,
                                TotalPrice = positionToken0ValueUSD
                            }
                        },
                        new Token
                        {
                            Type = TokenType.Supplied,
                            Name = position.Token1.Name,
                            Symbol = position.Token1.Symbol,
                            ContractAddress = position.Token1.Id,
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token1Decimals,
                                Amount = currentSupplyToken1 * (decimal)Math.Pow(10, token1Decimals),
                                BalanceFormatted = currentSupplyToken1,
                                Price = token1PriceUSD,
                                TotalPrice = positionToken1ValueUSD
                            }
                        },
                        new Token
                        {
                            Type = TokenType.Reward,
                            Name = position.Token0.Name,
                            Symbol = position.Token0.Symbol,
                            ContractAddress = position.Token0.Id,
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token0Decimals,
                                Amount = uncollectedFees.Amount0,
                                BalanceFormatted = uncollectedFees.Amount0,
                                Price = token0PriceUSD,
                                TotalPrice = uncollectedFees.Amount0 * token0PriceUSD
                            }
                        },
                        new Token
                        {
                            Type = TokenType.Reward,
                            Name = position.Token1.Name,
                            Symbol = position.Token1.Symbol,
                            ContractAddress = position.Token1.Id,
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token1Decimals,
                                Amount = uncollectedFees.Amount1,
                                BalanceFormatted = uncollectedFees.Amount1,
                                Price = token1PriceUSD,
                                TotalPrice = uncollectedFees.Amount1 * token1PriceUSD
                            }
                        }
                    }
                },
                AdditionalData = new AdditionalData()
            };

            walletItems.Add(walletItem);
        }

        return walletItems;
    }

    private Protocol GetUniswapV3Protocol(string chain)
    {
        return new Protocol
        {
            Name = "Uniswap V3",
            Chain = chain,
            Id = "uniswap-v3",
            Url = "https://app.uniswap.org",
            Logo = "https://cdn.moralis.io/defi/uniswap.png"
        };
    }

    private Protocol GetAaveProtocol(string chain)
    {
        return new Protocol
        {
            Name = "Aave V3",
            Chain = "Base", 
            Id = "aave-v3",
            Url = "https://app.aave.com",
            Logo = "https://cdn.moralis.io/defi/aave.png"
        };
    }

    private TokenType? ParseTokenType(string tokenType)
    {
        return tokenType?.ToLowerInvariant() switch
        {
            "supplied" => TokenType.Supplied,
            "borrowed" => TokenType.Borrowed,
            "reward" => TokenType.Reward,
            "native" => TokenType.Native,
            "staked" => TokenType.Staked,
            _ => null
        };
    }
}