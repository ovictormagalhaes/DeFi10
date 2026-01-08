using Microsoft.Extensions.Logging;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Protocols.Raydium.Models;
using DeFi10.API.Services.Protocols.Raydium.Clmm.DTO;
using DeFi10.API.Services.Protocols.Raydium.Clmm;
using Solnet.Programs;
using Solnet.Rpc;
using Solnet.Rpc.Core.Http;
using Solnet.Rpc.Messages;
using Solnet.Rpc.Models;
using Solnet.Rpc.Types;
using Solnet.Wallet;
using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Threading.Tasks;
using DeFi10.API.Services.Core.Solana;
using DeFi10.API.Services.Infrastructure;

namespace DeFi10.API.Services.Protocols.Raydium
{
    public class RaydiumOnChainService : IRaydiumOnChainService
    {
        private readonly IRpcClient _rpc;
        private readonly ILogger<RaydiumOnChainService> _logger;
        private readonly HttpClient _httpClient;
        private readonly IRaydiumApiService _raydiumApiService;
        private const string CLMM_PROGRAM_ID = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

        public RaydiumOnChainService(
            IRpcClientFactory rpcFactory,
            ILogger<RaydiumOnChainService> logger, 
            HttpClient httpClient,
            IRaydiumApiService raydiumApiService)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _raydiumApiService = raydiumApiService ?? throw new ArgumentNullException(nameof(raydiumApiService));
            _rpc = rpcFactory?.GetSolanaClient() ?? throw new ArgumentNullException(nameof(rpcFactory));            
        }

        public async Task<List<RaydiumPosition>> GetPositionsAsync(string walletAddress)
        {
            _logger.LogInformation("[Raydium CLMM] Starting GetPositionsAsync for wallet: {Wallet}", walletAddress);
            var startTime = DateTime.UtcNow;
            var positions = new List<RaydiumPosition>();

            if (!PublicKey.IsValid(walletAddress))
            {
                _logger.LogError("[Raydium CLMM] Invalid wallet address format: {Wallet}", walletAddress);
                return positions;
            }

            const string TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
            
            _logger.LogInformation("[Raydium CLMM] Fetching token accounts for wallet: {Wallet}", walletAddress);
            
            var allTokenAccounts = new List<TokenAccount>();
            
            // Query SPL Token accounts with retry
            try
            {
                var tokenAccountsResult = await RetryRpcCallAsync(async () =>
                    await _rpc.GetTokenAccountsByOwnerAsync(
                        walletAddress, null, TokenProgram.ProgramIdKey, Commitment.Finalized),
                    "SPL Token", 3);
                
                if (tokenAccountsResult.WasSuccessful && tokenAccountsResult.Result?.Value != null)
                {
                    allTokenAccounts.AddRange(tokenAccountsResult.Result.Value);
                    _logger.LogInformation("[Raydium CLMM] Successfully fetched {Count} SPL Token accounts", tokenAccountsResult.Result.Value.Count);
                }
                else
                {
                    var errorMsg = tokenAccountsResult?.Reason?.ToString() ?? "Unknown error";
                    var errorData = tokenAccountsResult?.ErrorData?.ToString() ?? "No error data";
                    _logger.LogError("[Raydium CLMM] SPL Token query failed - WasSuccessful: {Success}, Reason: {Reason}, ErrorData: {ErrorData}",
                        tokenAccountsResult?.WasSuccessful, errorMsg, errorData);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Raydium CLMM] Exception during SPL Token query: {Message}, StackTrace: {StackTrace}", 
                    ex.Message, ex.StackTrace);
            }
            
            // Query Token-2022 accounts with retry
            try
            {
                var token2022AccountsResult = await RetryRpcCallAsync(async () =>
                    await _rpc.GetTokenAccountsByOwnerAsync(
                        walletAddress, null, TOKEN_2022_PROGRAM, Commitment.Finalized),
                    "Token-2022", 3);
                
                if (token2022AccountsResult.WasSuccessful && token2022AccountsResult.Result?.Value != null)
                {
                    allTokenAccounts.AddRange(token2022AccountsResult.Result.Value);
                    _logger.LogInformation("[Raydium CLMM] Successfully fetched {Count} Token-2022 accounts", token2022AccountsResult.Result.Value.Count);
                }
                else
                {
                    var errorMsg = token2022AccountsResult?.Reason?.ToString() ?? "Unknown error";
                    var errorData = token2022AccountsResult?.ErrorData?.ToString() ?? "No error data";
                    _logger.LogError("[Raydium CLMM] Token-2022 query failed - WasSuccessful: {Success}, Reason: {Reason}, ErrorData: {ErrorData}",
                        token2022AccountsResult?.WasSuccessful, errorMsg, errorData);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Raydium CLMM] Exception during Token-2022 query: {Message}, StackTrace: {StackTrace}", 
                    ex.Message, ex.StackTrace);
            }

            _logger.LogInformation("[Raydium CLMM] Found {Count} total token accounts for wallet: {Wallet}", allTokenAccounts.Count, walletAddress);

            if (!allTokenAccounts.Any())
            {
                _logger.LogInformation("[Raydium CLMM] No token accounts found, returning empty positions");
                return positions;
            }

            var positionNfts = new List<string>();
            
            foreach (var ta in allTokenAccounts)
            {
                try
                {
                    var parsed = ta.Account?.Data?.Parsed;
                    if (parsed != null)
                    {
                        var info = parsed.Info;
                        var mint = info.Mint?.ToString();
                        var tokenAmount = info.TokenAmount;
                        if (!string.IsNullOrEmpty(mint) && tokenAmount != null)
                        {
                            ulong amount = tokenAmount.AmountUlong;
                            byte decimals = (byte)tokenAmount.Decimals;
                                            if (amount == 1 && decimals == 0)
                            {
                                positionNfts.Add(mint);
                                                }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"[Raydium CLMM] Failed parsing token account (parsed)");
                }
            }

            if (!positionNfts.Any())
            {
                var tokenAccountKeys = allTokenAccounts.Select(x => x.PublicKey).ToList();
                var multipleAccountsResult = await _rpc.GetMultipleAccountsAsync(tokenAccountKeys, Commitment.Finalized);
                if (!multipleAccountsResult.WasSuccessful)
                {
                    _logger.LogError($"[Raydium CLMM] GetMultipleAccountsAsync for token accounts failed: {multipleAccountsResult.ErrorData}");
                    return positions;
                }

                var potentialNftMints = new List<string>();
                for (int i = 0; i < multipleAccountsResult.Result.Value.Count; i++)
                {
                    var accInfo = multipleAccountsResult.Result.Value[i];
                    if (accInfo == null) continue;
                    try
                    {
                        var rawData = Convert.FromBase64String(accInfo.Data[0]);
                                    var tokenAccountData = SplTokenAccountLayout.Parse(rawData);
                                    if (tokenAccountData.Amount == 1)
                        {
                            potentialNftMints.Add(tokenAccountData.Mint);
                                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"[Raydium CLMM] Failed parsing token account index={i}");
                    }
                }

                if (potentialNftMints.Any())
                {
                    var mintInfosResult = await _rpc.GetMultipleAccountsAsync(potentialNftMints, Commitment.Finalized);
                    if (!mintInfosResult.WasSuccessful)
                    {
                        _logger.LogWarning($"[Raydium CLMM] Failed to fetch mint accounts for candidates: {mintInfosResult.ErrorData}");
                    }
                    else
                    {
                        for (int i = 0; i < mintInfosResult.Result.Value.Count; i++)
                        {
                            var mintAcc = mintInfosResult.Result.Value[i];
                            var mintAddr = potentialNftMints[i];
                            if (mintAcc == null) continue;
                            try
                            {
                                var mintData = SplMintAccountLayout.Parse(Convert.FromBase64String(mintAcc.Data[0]));
                                if (mintData.Decimals == 0)
                                {
                                    positionNfts.Add(mintAddr);
                                                        }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, $"[Raydium CLMM] Failed parsing mint {mintAddr}");
                            }
                        }
                    }
                }
            }

            if (!positionNfts.Any())
            {
                _logger.LogDebug("[Raydium CLMM] No NFTs found via scan. Attempting fallback ATA derivation for known debug mints.");
                var debugMints = new List<string>
                {
                    "5jzVQdESbretaB6JRvvHejjQhRwFCS1jr3ystKJDrwK4"
                };

                foreach (var mint in debugMints.Where(m => PublicKey.IsValid(m)))
                {
                    try
                    {
                        var ata = DeriveAssociatedTokenAccount(walletAddress, mint);
                                    var ataInfo = await _rpc.GetAccountInfoAsync(ata, Commitment.Finalized);
                        if (!ataInfo.WasSuccessful || ataInfo.Result.Value == null)
                        {
                                            continue;
                        }
                        var ataRaw = Convert.FromBase64String(ataInfo.Result.Value.Data[0]);
                        SplTokenAccountData ataParsed;
                        try { ataParsed = SplTokenAccountLayout.Parse(ataRaw); }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, $"[Raydium CLMM] Failed to parse ATA for mint={mint}");
                            continue;
                        }
                        var mintInfo = await _rpc.GetAccountInfoAsync(mint, Commitment.Finalized);
                        if (!mintInfo.WasSuccessful || mintInfo.Result.Value == null)
                        {
                                            continue;
                        }
                        try
                        {
                            var mintRaw = Convert.FromBase64String(mintInfo.Result.Value.Data[0]);
                            var md = SplMintAccountLayout.Parse(mintRaw);
                                            if (ataParsed.Amount == 1 && md.Decimals == 0)
                            {
                                positionNfts.Add(mint);
                                                }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, $"[Raydium CLMM] Failed parsing fallback mint={mint}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"[Raydium CLMM] Error during fallback ATA attempt mint={mint}");
                    }
                }
            }

            _logger.LogInformation("[Raydium CLMM] Found {Count} position NFTs for wallet: {Wallet}", positionNfts.Count, walletAddress);

            if (!positionNfts.Any())
            {
                _logger.LogInformation("[Raydium CLMM] No position NFTs found, returning empty positions");
                return positions;
            }

            var positionPdas = positionNfts.Select(DerivePositionPdaFromNftMint).Where(p => p != null).ToList();
            _logger.LogInformation("[Raydium CLMM] Derived {Count} position PDAs from NFTs", positionPdas.Count);
            
            if (!positionPdas.Any())
            {
                _logger.LogWarning("[Raydium CLMM] No PDAs derived from NFTs");
                return positions;
            }

            _logger.LogInformation("[Raydium CLMM] Fetching position account data for {Count} PDAs", positionPdas.Count);
            var posAccounts = await _rpc.GetMultipleAccountsAsync(positionPdas, Commitment.Finalized);
            if (!posAccounts.WasSuccessful)
            {
                _logger.LogError("[Raydium CLMM] GetMultipleAccountsAsync for position PDAs failed: {ErrorData}", posAccounts.ErrorData);
                return positions;
            }

            // Parse positions to get pool IDs, then fetch APRs
            var poolIds = new List<string>();
            foreach (var acc in posAccounts.Result.Value.Where(v => v != null))
            {
                try
                {
                    var layoutBytes = Convert.FromBase64String(acc.Data[0]);
                    var layout = ClmmPositionDTO.Parse(layoutBytes);
                    if (!poolIds.Contains(layout.PoolId))
                    {
                        poolIds.Add(layout.PoolId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Raydium CLMM] Failed to parse position for pool ID extraction");
                }
            }

            // Fetch APRs for all pools in one API call
            Dictionary<string, decimal> poolAprs = new();
            if (poolIds.Any())
            {
                try
                {
                    poolAprs = await _raydiumApiService.GetPoolAprsAsync(poolIds);
                    _logger.LogInformation("[Raydium CLMM] Fetched APRs for {Count} pools", poolAprs.Count);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Raydium CLMM] Failed to fetch pool APRs from Raydium API");
                }
            }

            // Process each position with index to map back to PDA
            for (int idx = 0; idx < posAccounts.Result.Value.Count; idx++)
            {
                var acc = posAccounts.Result.Value[idx];
                if (acc == null) continue;
                
                var positionPda = positionPdas[idx]; // Get the corresponding PDA address
                
                try
                {
                    var layoutBytes = Convert.FromBase64String(acc.Data[0]);
                                    
                    var layout = ClmmPositionDTO.Parse(layoutBytes);
        
                    var poolInfo = await _rpc.GetAccountInfoAsync(layout.PoolId, Commitment.Finalized);
                    if (!poolInfo.WasSuccessful || poolInfo.Result.Value == null)
                    {
                        _logger.LogWarning($"[Raydium CLMM] Pool account missing poolId={layout.PoolId}");
                        continue;
                    }

                    var poolBytes = Convert.FromBase64String(poolInfo.Result.Value.Data[0]);
                    var pool = ClmmPoolDTO.Parse(poolBytes, layout.PoolId, _logger);
                
                    // Fetch AmmConfig to get TradeFeeRate
                    var ammConfigInfo = await _rpc.GetAccountInfoAsync(pool.AmmConfig, Commitment.Finalized);
                    if (!ammConfigInfo.WasSuccessful || ammConfigInfo.Result.Value == null)
                    {
                        _logger.LogWarning($"[Raydium CLMM] AmmConfig account missing configId={pool.AmmConfig}");
                        continue;
                    }
                    
                    var ammConfigBytes = Convert.FromBase64String(ammConfigInfo.Result.Value.Data[0]);
                    var ammConfig = AmmConfigDTO.Parse(ammConfigBytes);
                    
                    _logger.LogInformation("[Raydium CLMM] Position {PoolId} - AmmConfig={Config}, TradeFeeRate={FeeRate}", 
                        layout.PoolId, pool.AmmConfig, ammConfig.TradeFeeRate);
                
                
                    if (layout.Liquidity == 0)
                    {
                                    continue;
                    }

                    var amounts = GetAmounts(layout, pool);
                    var tokenAAmount = (decimal)amounts.AmountA;
                    var tokenBAmount = (decimal)amounts.AmountB;
        
                    var tokenADecimals = await GetTokenDecimals(pool.TokenMintA);
                    var tokenBDecimals = await GetTokenDecimals(pool.TokenMintB);
                            
                                            
                    for (int i = 0; i < layout.RewardInfos.Length; i++)
                    {
                        var reward = layout.RewardInfos[i];
                                }
                    
                    // Fetch tick data for accurate fee calculation
                            var tickLowerTask = GetTickDataAsync(layout.PoolId, layout.TickLower, pool.TickSpacing);
                    var tickUpperTask = GetTickDataAsync(layout.PoolId, layout.TickUpper, pool.TickSpacing);
                    await Task.WhenAll(tickLowerTask, tickUpperTask);
                    
                    var tickLowerData = await tickLowerTask;
                    var tickUpperData = await tickUpperTask;
                    
                    if (tickLowerData != null && tickUpperData != null)
                    {
                                }
                    else
                    {
                        _logger.LogWarning($"[Raydium CLMM] Failed to fetch one or both tick boundaries - fee calculation will be approximate");
                    }
                    
                    // Calculate uncollected fees using proper formula with tick data
                    var feeCalculator = new Models.RaydiumUncollectedFees();
                    var uncollectedFees = feeCalculator.CalculateUncollectedFees(
                        layout, 
                        pool, 
                        tokenADecimals, 
                        tokenBDecimals,
                        tickLowerData,
                        tickUpperData,
                        _logger);
                    
                    // Convert back to raw amounts (ulong) for the token list
                    ulong finalFeeToken0 = (ulong)(uncollectedFees.Amount0 * (decimal)Math.Pow(10, tokenADecimals));
                    ulong finalFeeToken1 = (ulong)(uncollectedFees.Amount1 * (decimal)Math.Pow(10, tokenBDecimals));
                            
                    var tokenList = new List<SplToken>
                    {
                        new SplToken { Mint = pool.TokenMintA, Amount = tokenAAmount, Decimals = tokenADecimals, Type = TokenType.Supplied },
                        new SplToken { Mint = pool.TokenMintB, Amount = tokenBAmount, Decimals = tokenBDecimals, Type = TokenType.Supplied }
                    };
                    
                    // Fetch historical collected fees from transaction history
                    _logger.LogInformation("[Raydium CLMM] Calling GetHistoricalCollectedFeesAsync for position PDA: {Pda}", positionPda);
                    var (historicalFeesToken0, historicalFeesToken1) = await GetHistoricalCollectedFeesAsync(
                        positionPda, pool.TokenMintA, pool.TokenMintB, tokenADecimals, tokenBDecimals);
                    _logger.LogInformation("[Raydium CLMM] GetHistoricalCollectedFeesAsync returned: Token0={Fee0}, Token1={Fee1}", 
                        historicalFeesToken0, historicalFeesToken1);
                    
                    // Add historical collected fees (total fees already collected/withdrawn)
                    if (historicalFeesToken0 > 0)
                    {
                        tokenList.Add(new SplToken 
                        { 
                            Mint = pool.TokenMintA, 
                            Amount = historicalFeesToken0, 
                            Decimals = tokenADecimals, 
                            Type = TokenType.LiquidityCollectedFee 
                        });
                    }
                    if (historicalFeesToken1 > 0)
                    {
                        tokenList.Add(new SplToken 
                        { 
                            Mint = pool.TokenMintB, 
                            Amount = historicalFeesToken1, 
                            Decimals = tokenBDecimals, 
                            Type = TokenType.LiquidityCollectedFee 
                        });
                    }
                    
                    // Add uncollected fees (calculated from pool state and tick data)
                    if (finalFeeToken0 > 0)
                    {
                        tokenList.Add(new SplToken 
                        { 
                            Mint = pool.TokenMintA, 
                            Amount = finalFeeToken0, 
                            Decimals = tokenADecimals, 
                            Type = TokenType.LiquidityUncollectedFee 
                        });
                                }
                    if (finalFeeToken1 > 0)
                    {
                        tokenList.Add(new SplToken 
                        { 
                            Mint = pool.TokenMintB, 
                            Amount = finalFeeToken1, 
                            Decimals = tokenBDecimals, 
                            Type = TokenType.LiquidityUncollectedFee 
                        });
                                }
                    
                    // Add reward tokens (these are separate from trading fees)
                    for (int i = 0; i < layout.RewardInfos.Length; i++)
                    {
                        var reward = layout.RewardInfos[i];
                        if (reward.RewardAmountOwed > 0)
                        {
                            // Note: Reward token mints would need to be fetched from pool reward info
                            // For now, we're just logging them
                                        }
                    }
                    
                    // Try to get the creation timestamp from the first transaction on the position NFT mint
                    long? createdAt = null;
                    try
                    {
                        // Find the NFT mint for this position by matching PDA
                        _logger.LogDebug("[Raydium CLMM] Searching for NFT mint matching position PDA: {Pda}. Total NFTs: {Count}", 
                            positionPda, positionNfts.Count);
                        var positionNftMint = positionNfts.FirstOrDefault(nft =>
                        {
                            var derivedPda = DerivePositionPdaFromNftMint(nft);
                            _logger.LogTrace("[Raydium CLMM] NFT {Nft} -> Derived PDA {Pda}, Expected PDA {Expected}", 
                                nft, derivedPda, positionPda);
                            return derivedPda == positionPda; // Compare with position PDA
                        });

                        if (!string.IsNullOrEmpty(positionNftMint))
                        {
                            _logger.LogDebug("[Raydium CLMM] Found matching NFT mint: {Mint}, fetching timestamp...", positionNftMint);
                            createdAt = await GetNftMintTimestampAsync(positionNftMint);
                            if (createdAt.HasValue)
                            {
                                _logger.LogInformation("[Raydium CLMM] Successfully fetched CreatedAt for position: {Timestamp}", createdAt.Value);
                            }
                            else
                            {
                                _logger.LogWarning("[Raydium CLMM] GetNftMintTimestampAsync returned null for mint {Mint}", positionNftMint);
                            }
                        }
                        else
                        {
                            _logger.LogWarning("[Raydium CLMM] No matching NFT mint found for position PDA {Pda}", positionPda);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[Raydium CLMM] Failed to fetch creation timestamp for position PDA {Pda}", positionPda);
                    }

                    var tierPercent = FormatFeeTier(ammConfig.TradeFeeRate);
                    _logger.LogInformation("[Raydium CLMM] Position {PoolId} - TradeFeeRate={FeeRate} -> TierPercent={Tier}%", 
                        layout.PoolId, ammConfig.TradeFeeRate, tierPercent);

                    // Get APR for this pool
                    poolAprs.TryGetValue(layout.PoolId, out var poolApr);

                    positions.Add(new RaydiumPosition
                    {
                        Pool = layout.PoolId,
                        Tokens = tokenList,
                        TotalValueUsd = 0,
                        Apr = poolApr > 0 ? poolApr : null,
                        SqrtPriceX96 = pool.SqrtPriceX64.ToString(),
                        TickLower = layout.TickLower,
                        TickUpper = layout.TickUpper,
                        TickCurrent = pool.TickCurrent,
                        CreatedAt = createdAt,
                        TierPercent = tierPercent
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Raydium CLMM] Failed parsing position account.");
                }
            }

            var duration = (DateTime.UtcNow - startTime).TotalMilliseconds;
            _logger.LogInformation("[Raydium CLMM] Completed GetPositionsAsync for wallet: {Wallet} - Found {Count} positions in {Duration}ms", 
                walletAddress, positions.Count, duration);

            return positions;
        }

        private (BigInteger AmountA, BigInteger AmountB) GetAmounts(ClmmPositionDTO position, ClmmPoolDTO pool)
        {
            var liquidity = position.Liquidity;
            var currentTick = pool.TickCurrent;
            var lowerTick = position.TickLower;
            var upperTick = position.TickUpper;


            if (liquidity == 0)
            {
                return (BigInteger.Zero, BigInteger.Zero);
            }

            try
            {
                var (amountA, amountB) = RaydiumMath.CalculateTokenAmounts(
                    liquidity,
                    lowerTick,
                    upperTick,
                    pool.SqrtPriceX64
                );

                    return (amountA, amountB);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Raydium CLMM] Error calculating token amounts");
                return (BigInteger.Zero, BigInteger.Zero);
            }
        }

        private async Task<decimal> GetTokenBalance(string tokenAccount)
        {
            var bal = await _rpc.GetTokenAccountBalanceAsync(tokenAccount, Commitment.Finalized);
            if (bal.WasSuccessful && bal.Result?.Value?.Amount != null && ulong.TryParse(bal.Result.Value.Amount, out var amount))
            {
                return amount;
            }
            _logger.LogWarning($"[Raydium CLMM] Failed to get token balance for {tokenAccount}.");
            return 0m;
        }

        private string DerivePositionPdaFromNftMint(string nftMint)
        {
            if (!PublicKey.IsValid(nftMint))
            {
                _logger.LogWarning($"[Raydium CLMM] Invalid NFT Mint format for PDA derivation: {nftMint}");
                return null;
            }

            PublicKey.TryFindProgramAddress(
                new List<byte[]>
                {
                    System.Text.Encoding.UTF8.GetBytes("position"),
                    new PublicKey(nftMint).KeyBytes
                },
                new PublicKey(CLMM_PROGRAM_ID),
                out var pda,
                out _
            );

            if (pda == null)
            {
                _logger.LogWarning($"[Raydium CLMM] Could not derive PDA for NFT: {nftMint}");
                return null;
            }

            return pda.Key;
        }

        private string DeriveAssociatedTokenAccount(string wallet, string mint)
        {
            const string ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvR93Xkhl7EyrhiJpF2KrFs1J8ZDEGkGx6D8";
            try
            {
                PublicKey.TryFindProgramAddress(new List<byte[]>
                {
                    new PublicKey(wallet).KeyBytes,
                    new PublicKey(TokenProgram.ProgramIdKey.Key).KeyBytes,
                    new PublicKey(mint).KeyBytes
                }, new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID), out var ata, out _);
                return ata?.Key ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"[Raydium CLMM] Failed deriving ATA wallet={wallet} mint={mint}");
                return string.Empty;
            }
        }

        private async Task<int> GetTokenDecimals(string mintAddress)
        {
            try
            {
                var mintInfo = await _rpc.GetAccountInfoAsync(mintAddress, Commitment.Finalized);
                if (!mintInfo.WasSuccessful || mintInfo.Result?.Value?.Data == null)
                {
                    _logger.LogWarning($"[Raydium CLMM] Failed to fetch mint info for {mintAddress}");
                    return 0;
                }

                var mintData = Convert.FromBase64String(mintInfo.Result.Value.Data[0]);
                var parsed = SplMintAccountLayout.Parse(mintData);
                return parsed.Decimals;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"[Raydium CLMM] Error fetching decimals for mint={mintAddress}");
                return 0;
            }
        }

        private string DeriveTickArrayPDA(string poolAddress, int startTickIndex)
        {
            const string TICK_ARRAY_SEED = "tick_array";
            try
            {
                var tickIndexBytes = new byte[4];
                BinaryPrimitives.WriteInt32BigEndian(tickIndexBytes, startTickIndex);

                PublicKey.TryFindProgramAddress(new List<byte[]>
                {
                    System.Text.Encoding.UTF8.GetBytes(TICK_ARRAY_SEED),
                    new PublicKey(poolAddress).KeyBytes,
                    tickIndexBytes
                }, new PublicKey(CLMM_PROGRAM_ID), out var pda, out _);
                
                return pda?.Key ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"[Raydium CLMM] Failed deriving tick array PDA pool={poolAddress} startTick={startTickIndex}");
                return string.Empty;
            }
        }

        private int GetTickArrayStartIndex(int tickIndex, int tickSpacing)
        {
            
            const int TICK_ARRAY_SIZE = 60;
            int ticksPerArray = tickSpacing * TICK_ARRAY_SIZE;
            int startIndex;
            
            if (tickIndex < 0 && tickIndex % ticksPerArray != 0)
            {
                startIndex = (int)Math.Ceiling((double)tickIndex / ticksPerArray) - 1;
            }
            else
            {
                startIndex = (int)Math.Floor((double)tickIndex / ticksPerArray);
            }
            
            return startIndex * ticksPerArray;
        }

        /// <summary>
        /// Fetches tick data from a tick array account
        /// </summary>
        private async Task<Clmm.DTO.ClmmTickDTO?> GetTickDataAsync(
            string poolAddress, 
            int tickIndex, 
            int tickSpacing)
        {
            try
            {
    
                var startTickIndex = GetTickArrayStartIndex(tickIndex, tickSpacing);
                var tickArrayPda = DeriveTickArrayPDA(poolAddress, startTickIndex);
                
    
                var accountInfo = await _rpc.GetAccountInfoAsync(tickArrayPda, Commitment.Confirmed);

                if (accountInfo?.Result?.Value?.Data == null || accountInfo.Result.Value.Data.Count == 0)
                {
                    _logger.LogWarning($"[Raydium CLMM] Tick array account not found for tick {tickIndex}");
                    return null;
                }

                var accountData = Convert.FromBase64String(accountInfo.Result.Value.Data[0]);
                
    
                return ParseTickFromArray(accountData, tickIndex, tickSpacing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[Raydium CLMM] Error fetching tick data for tick {tickIndex}");
                return null;
            }
        }

        /// <summary>
        /// Parses tick data from a tick array account
        /// Raydium stores multiple ticks in a single account for efficiency
        /// </summary>
        private Clmm.DTO.ClmmTickDTO? ParseTickFromArray(byte[] data, int targetTickIndex, int tickSpacing)
        {
            try
            {
                // Raydium TickArray structure:
                // - 8 bytes: discriminator
                // - 32 bytes: pool id
                // - 4 bytes: start tick index
                // - Array of tick data (60 ticks)
                
                if (data.Length < 44)
                {
                    _logger.LogWarning($"[Raydium CLMM] Tick array data too short: {data.Length} bytes");
                    return null;
                }

                int offset = 8; // Skip discriminator
                
                // Skip pool id (32 bytes)
                offset += 32;
                
                // Read start tick index
                int startTickIndex = BitConverter.ToInt32(data, offset);
                offset += 4;

    
                // Calculate which tick in the array we need
                int tickIndexInArray = (targetTickIndex - startTickIndex) / tickSpacing;
                
                if (tickIndexInArray < 0 || tickIndexInArray >= 60)
                {
                    _logger.LogWarning($"[Raydium CLMM] Tick {targetTickIndex} not in array starting at {startTickIndex}");
                    return null;
                }

                // Each tick entry structure in Raydium CLMM (based on Rust struct):
                // pub struct TickState {
                //     pub tick: i32,                           // 4 bytes
                //     pub liquidity_net: i128,                 // 16 bytes
                //     pub liquidity_gross: u128,               // 16 bytes
                //     pub fee_growth_outside_0_x64: u128,      // 16 bytes
                //     pub fee_growth_outside_1_x64: u128,      // 16 bytes
                //     pub reward_growths_outside_x64: [u128; 3], // 48 bytes (3 * 16)
                //     pub padding: [u32; 13],                  // 52 bytes (13 * 4)
                // }
                // Total: 168 bytes per tick
                
                const int TICK_SIZE = 168;
                int tickOffset = offset + (tickIndexInArray * TICK_SIZE);
                
                    
                if (data.Length < tickOffset + TICK_SIZE)
                {
                    _logger.LogWarning($"[Raydium CLMM] Not enough data for tick at index {tickIndexInArray}");
                    return null;
                }

                // Read tick data following Rust struct layout
                var tick = new Clmm.DTO.ClmmTickDTO
                {
                    TickIndex = BitConverter.ToInt32(data, tickOffset), // Read tick i32 from the struct
                    LiquidityNet = ReadI128(data.AsSpan(tickOffset + 4, 16)),
                    LiquidityGross = ReadU128(data.AsSpan(tickOffset + 20, 16)),
                    FeeGrowthOutside0X64 = ReadU128(data.AsSpan(tickOffset + 36, 16)),
                    FeeGrowthOutside1X64 = ReadU128(data.AsSpan(tickOffset + 52, 16)),
                    RewardGrowthsOutsideX64 = new[]
                    {
                        ReadU128(data.AsSpan(tickOffset + 68, 16)),
                        ReadU128(data.AsSpan(tickOffset + 84, 16)),
                        ReadU128(data.AsSpan(tickOffset + 100, 16))
                    }
                };

    
                return tick;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Raydium CLMM] Error parsing tick data from array");
                return null;
            }
        }

        /// <summary>
        /// Reads an unsigned 128-bit integer from byte span (little-endian)
        /// </summary>
        private static BigInteger ReadU128(ReadOnlySpan<byte> data)
        {
            var buf = data.ToArray();
            if (!BitConverter.IsLittleEndian) Array.Reverse(buf);
            var tmp = new byte[17];
            Array.Copy(buf, tmp, 16);
            tmp[16] = 0;
            return new BigInteger(tmp);
        }

        /// <summary>
        /// Reads a signed 128-bit integer from byte span (little-endian)
        /// </summary>
        private static BigInteger ReadI128(ReadOnlySpan<byte> data)
        {
            var bytes = data.ToArray();
            if (!BitConverter.IsLittleEndian) Array.Reverse(bytes);
            
            // Extend to 17 bytes for BigInteger with sign preservation
            var tmp = new byte[17];
            Array.Copy(bytes, tmp, 16);
            
            // Check if negative (MSB set in original 16 bytes)
            bool isNegative = (bytes[15] & 0x80) != 0;
            tmp[16] = isNegative ? (byte)0xFF : (byte)0x00;
            
            return new BigInteger(tmp);
        }







        private async Task<(ulong feeToken0, ulong feeToken1)?> FetchPositionFeesFromRaydiumApi(string positionNftMint)
        {
            try
            {
                var endpoints = new[]
                {
                    $"https://api-v3.raydium.io/clmm/position/{positionNftMint}",
                    $"https://api.raydium.io/v2/clmm/position/{positionNftMint}",
                };

                foreach (var endpoint in endpoints)
                {
                    try
                    {
                                    
                        var response = await _httpClient.GetAsync(endpoint);
                        
                                    
                        if (!response.IsSuccessStatusCode)
                        {
                            var errorBody = await response.Content.ReadAsStringAsync();
                            _logger.LogWarning($"[Raydium CLMM] API returned status: {response.StatusCode}, body: {errorBody}");
                            continue;
                        }

                        var json = await response.Content.ReadAsStringAsync();
                                    
                        if (string.IsNullOrWhiteSpace(json))
                        {
                            _logger.LogWarning($"[Raydium CLMM] API returned empty response");
                            continue;
                        }
                        
                        var apiData = System.Text.Json.JsonDocument.Parse(json);
                        
                                    
                        if (apiData.RootElement.TryGetProperty("data", out var data))
                        {
                                            if (TryExtractFeesFromApiData(data, out var fees))
                            {
                                                    if (ValidateApiFees(fees.feeToken0, fees.feeToken1))
                                {
                                    return fees;
                                }
                                else
                                {
                                    _logger.LogWarning($"[Raydium CLMM] Fees validation failed for values: Token0={fees.feeToken0}, Token1={fees.feeToken1}");
                                }
                            }
                            else
                            {
                                _logger.LogWarning($"[Raydium CLMM] Failed to extract fees from 'data' property");
                            }
                        }
                        else if (TryExtractFeesFromApiData(apiData.RootElement, out var fees2))
                        {
                                            if (ValidateApiFees(fees2.feeToken0, fees2.feeToken1))
                            {
                                return fees2;
                            }
                            else
                            {
                                _logger.LogWarning($"[Raydium CLMM] Fees validation failed for root values: Token0={fees2.feeToken0}, Token1={fees2.feeToken1}");
                            }
                        }
                        else
                        {
                            _logger.LogWarning($"[Raydium CLMM] Could not find 'data' property or extract fees from root element");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"[Raydium CLMM] Error fetching from endpoint: {endpoint}");
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"[Raydium CLMM] Error fetching position fees from Raydium API");
                return null;
            }
        }

        private bool TryExtractFeesFromApiData(System.Text.Json.JsonElement element, out (ulong feeToken0, ulong feeToken1) fees)
        {
            fees = (0, 0);

            try
            {
                if (element.TryGetProperty("pendingFees", out var pendingFees))
                {
                    if (pendingFees.TryGetProperty("tokenA", out var tokenA) &&
                        pendingFees.TryGetProperty("tokenB", out var tokenB))
                    {
                        fees = (
                            ulong.Parse(tokenA.GetString() ?? "0"),
                            ulong.Parse(tokenB.GetString() ?? "0")
                        );
                        return true;
                    }
                }

                if (element.TryGetProperty("tokenFeeAmountA", out var feeA) &&
                    element.TryGetProperty("tokenFeeAmountB", out var feeB))
                {
                    fees = (
                        ulong.Parse(feeA.GetString() ?? "0"),
                        ulong.Parse(feeB.GetString() ?? "0")
                    );
                    return true;
                }

                if (element.TryGetProperty("uncollectedFees", out var uncollected) &&
                    uncollected.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    var arr = uncollected.EnumerateArray().ToArray();
                    if (arr.Length >= 2)
                    {
                        fees = (
                            ulong.Parse(arr[0].GetString() ?? "0"),
                            ulong.Parse(arr[1].GetString() ?? "0")
                        );
                        return true;
                    }
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"[Raydium CLMM] Error extracting fees from API data");
                return false;
            }
        }

        /// <summary>
        /// Gets the creation timestamp of an NFT mint by fetching its first transaction
        /// </summary>
        private async Task<long?> GetNftMintTimestampAsync(string mintAddress)
        {
            try
            {
                _logger.LogDebug("[Raydium CLMM] Fetching signatures for mint {Mint} to find creation timestamp", mintAddress);
                
                // Get all signatures for the mint address to find the oldest one (creation transaction)
                // Note: GetSignaturesForAddressAsync returns signatures in descending order (newest first)
                // So we need to get all of them and take the last one
                var signaturesResult = await _rpc.GetSignaturesForAddressAsync(
                    mintAddress, 
                    limit: 1000, // Get many signatures to ensure we get the oldest
                    commitment: Commitment.Finalized);

                if (!signaturesResult.WasSuccessful || 
                    signaturesResult.Result == null || 
                    !signaturesResult.Result.Any())
                {
                    _logger.LogWarning("[Raydium CLMM] No signatures found for mint {Mint}", mintAddress);
                    return null;
                }

                _logger.LogDebug("[Raydium CLMM] Found {Count} signatures for mint {Mint}", 
                    signaturesResult.Result.Count, mintAddress);

                // Last signature in the list is the oldest (creation transaction)
                var firstSignature = signaturesResult.Result.Last();
                
                if (firstSignature.BlockTime.HasValue)
                {
                    _logger.LogInformation("[Raydium CLMM] Found creation timestamp for mint {Mint}: {Timestamp} ({Date})", 
                        mintAddress, firstSignature.BlockTime.Value, 
                        DateTimeOffset.FromUnixTimeSeconds((long)firstSignature.BlockTime.Value).DateTime);
                    return (long)firstSignature.BlockTime.Value;
                }

                _logger.LogWarning("[Raydium CLMM] No block time found in signature for mint {Mint}", mintAddress);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Raydium CLMM] Failed to fetch creation timestamp for mint {Mint}", mintAddress);
                return null;
            }
        }

        /// <summary>
        /// Makes a direct HTTP RPC call to get transaction with versioned transaction support
        /// </summary>
        private async Task<TransactionMetaInfo?> GetTransactionWithVersionSupportAsync(string signature)
        {
            try
            {
                var request = new
                {
                    jsonrpc = "2.0",
                    id = 1,
                    method = "getTransaction",
                    @params = new object[]
                    {
                        signature,
                        new
                        {
                            encoding = "jsonParsed",
                            commitment = "finalized",
                            maxSupportedTransactionVersion = 0
                        }
                    }
                };

                var json = System.Text.Json.JsonSerializer.Serialize(request);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                
                var response = await _httpClient.PostAsync(_rpc.NodeAddress.ToString(), content);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[Raydium CLMM] HTTP request failed for {Sig}: Status={Status}", signature, response.StatusCode);
                    return null;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var jsonDoc = System.Text.Json.JsonDocument.Parse(responseJson);
                
                if (!jsonDoc.RootElement.TryGetProperty("result", out var result) || result.ValueKind == System.Text.Json.JsonValueKind.Null)
                {
                    _logger.LogWarning("[Raydium CLMM] No result in HTTP response for {Sig}: ResponseJson={Json}", signature, responseJson.Length > 500 ? responseJson.Substring(0, 500) : responseJson);
                    return null;
                }

                // Extract meta from the response
                if (!result.TryGetProperty("meta", out var metaJson))
                {
                    _logger.LogWarning("[Raydium CLMM] No meta in HTTP response for {Sig}", signature);
                    return null;
                }

                var preTokenBalances = new List<TokenBalanceInfo>();
                var postTokenBalances = new List<TokenBalanceInfo>();

                if (metaJson.TryGetProperty("preTokenBalances", out var preBalances) && preBalances.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var balance in preBalances.EnumerateArray())
                    {
                        if (TryParseTokenBalance(balance, out var tokenBalance))
                        {
                            preTokenBalances.Add(tokenBalance);
                        }
                    }
                }

                if (metaJson.TryGetProperty("postTokenBalances", out var postBalances) && postBalances.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var balance in postBalances.EnumerateArray())
                    {
                        if (TryParseTokenBalance(balance, out var tokenBalance))
                        {
                            postTokenBalances.Add(tokenBalance);
                        }
                    }
                }

                return new TransactionMetaInfo
                {
                    PreTokenBalances = preTokenBalances,
                    PostTokenBalances = postTokenBalances
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Raydium CLMM] Failed to get versioned transaction {Sig} via HTTP: {Error}", signature, ex.Message);
                return null;
            }
        }

        private bool TryParseTokenBalance(System.Text.Json.JsonElement element, out TokenBalanceInfo tokenBalance)
        {
            tokenBalance = null!;
            try
            {
                if (!element.TryGetProperty("accountIndex", out var accountIndexEl) ||
                    !element.TryGetProperty("mint", out var mintEl) ||
                    !element.TryGetProperty("uiTokenAmount", out var uiAmountEl))
                {
                    return false;
                }

                if (!uiAmountEl.TryGetProperty("amount", out var amountEl) ||
                    !uiAmountEl.TryGetProperty("decimals", out var decimalsEl))
                {
                    return false;
                }

                tokenBalance = new TokenBalanceInfo
                {
                    AccountIndex = accountIndexEl.GetInt32(),
                    Mint = mintEl.GetString() ?? "",
                    Amount = amountEl.GetString() ?? "0",
                    Decimals = decimalsEl.GetInt32()
                };

                return true;
            }
            catch
            {
                return false;
            }
        }

        // Helper class to hold token balance info
        private class TokenBalanceInfo
        {
            public int AccountIndex { get; set; }
            public string Mint { get; set; } = "";
            public string Amount { get; set; } = "0";
            public int Decimals { get; set; }
        }

        // Helper class to hold transaction metadata
        private class TransactionMetaInfo
        {
            public List<TokenBalanceInfo> PreTokenBalances { get; set; } = new();
            public List<TokenBalanceInfo> PostTokenBalances { get; set; } = new();
        }

        /// <summary>
        /// Gets the historical collected fees for a position by analyzing transaction history
        /// Returns the total amount of fees that have been collected (withdrawn) from the position
        /// </summary>
        private async Task<(ulong feesToken0, ulong feesToken1)> GetHistoricalCollectedFeesAsync(
            string positionPda, 
            string token0Mint, 
            string token1Mint,
            int token0Decimals,
            int token1Decimals)
        {
            try
            {
                _logger.LogInformation("[Raydium CLMM] Fetching transaction history for position {Pda} to calculate collected fees", positionPda);
                
                // Get all transactions for the position PDA
                var signaturesResult = await _rpc.GetSignaturesForAddressAsync(
                    positionPda, 
                    limit: 1000,
                    commitment: Commitment.Finalized);

                if (!signaturesResult.WasSuccessful)
                {
                    _logger.LogWarning("[Raydium CLMM] Failed to get transaction history for position {Pda}: WasSuccessful=False, Reason={Reason}", 
                        positionPda, signaturesResult.Reason);
                    return (0, 0);
                }

                if (signaturesResult.Result == null)
                {
                    _logger.LogWarning("[Raydium CLMM] Failed to get transaction history for position {Pda}: Result is null", positionPda);
                    return (0, 0);
                }

                if (!signaturesResult.Result.Any())
                {
                    _logger.LogInformation("[Raydium CLMM] No transaction history found for position {Pda} (position may be newly created)", positionPda);
                    return (0, 0);
                }

                _logger.LogInformation("[Raydium CLMM] Found {Count} transactions for position {Pda}", 
                    signaturesResult.Result.Count, positionPda);

                ulong totalCollectedToken0 = 0;
                ulong totalCollectedToken1 = 0;
                int processedCount = 0;

                // Analyze each transaction to find "collect" operations
                foreach (var signature in signaturesResult.Result)
                {
                    try
                    {
                        TransactionMetaInfo? meta = null;
                        
                        // Try to get transaction with standard Solnet method first
                        var txResult = await _rpc.GetTransactionAsync(
                            signature.Signature,
                            Commitment.Finalized);

                        if (txResult.WasSuccessful && txResult.Result?.Transaction != null && txResult.Result.Meta != null)
                        {
                            // Successfully got transaction with standard method, use direct HTTP call to get full structure
                            _logger.LogTrace("[Raydium CLMM] Processing transaction {Sig} via HTTP to get token balance details", signature.Signature);
                            meta = await GetTransactionWithVersionSupportAsync(signature.Signature);
                        }
                        else
                        {
                            // Failed or versioned transaction, try direct HTTP call
                            _logger.LogTrace("[Raydium CLMM] Solnet method failed for {Sig} (Reason: {Reason}), trying HTTP method", 
                                signature.Signature, txResult.Reason ?? "Unknown");
                            meta = await GetTransactionWithVersionSupportAsync(signature.Signature);
                        }

                        if (meta == null)
                        {
                            _logger.LogTrace("[Raydium CLMM] Could not retrieve transaction {Sig} via any method", signature.Signature);
                            continue;
                        }
                        
                        // Look for token transfers that indicate fee collection
                        // In Raydium CLMM, "collect" operations transfer tokens from the position/pool to the owner
                        if (meta.PostTokenBalances != null && meta.PreTokenBalances != null)
                        {
                            int preCount = meta.PreTokenBalances.Count();
                            int postCount = meta.PostTokenBalances.Count();
                            _logger.LogTrace("[Raydium CLMM] Analyzing transaction {Sig} with {Pre} pre and {Post} post token balances",
                                signature.Signature, preCount, postCount);
                            
                            // Find balance changes for the fee tokens
                            foreach (var postBalance in meta.PostTokenBalances)
                            {
                                var preBalance = meta.PreTokenBalances.FirstOrDefault(
                                    pb => pb.AccountIndex == postBalance.AccountIndex);

                                if (preBalance == null) continue;

                                var mint = postBalance.Mint;
                                if (mint != token0Mint && mint != token1Mint)
                                    continue;

                                // Calculate the change in balance
                                if (ulong.TryParse(preBalance.Amount, out var preAmount) &&
                                    ulong.TryParse(postBalance.Amount, out var postAmount))
                                {
                                    // If balance decreased in the pool/position account, tokens were withdrawn (collected fees)
                                    if (preAmount > postAmount)
                                    {
                                        var amountCollected = preAmount - postAmount;
                                        
                                        _logger.LogTrace("[Raydium CLMM] Detected fee collection in tx {Sig}: mint={Mint}, amount={Amount}",
                                            signature.Signature, mint, amountCollected);
                                        
                                        if (mint == token0Mint)
                                            totalCollectedToken0 += amountCollected;
                                        else if (mint == token1Mint)
                                            totalCollectedToken1 += amountCollected;
                                    }
                                }
                            }
                        }

                        processedCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogTrace("[Raydium CLMM] Error processing transaction {Sig} for position {Pda}: {Error}", 
                            signature.Signature, positionPda, ex.Message);
                    }
                }

                _logger.LogInformation(
                    "[Raydium CLMM] Historical collected fees for position {Pda} - Processed {ProcessedCount} txs: Token0={Fee0} ({Formatted0}), Token1={Fee1} ({Formatted1})",
                    positionPda, processedCount, totalCollectedToken0, 
                    token0Decimals > 0 ? (totalCollectedToken0 / (decimal)Math.Pow(10, token0Decimals)).ToString("N9") : totalCollectedToken0.ToString(),
                    totalCollectedToken1,
                    token1Decimals > 0 ? (totalCollectedToken1 / (decimal)Math.Pow(10, token1Decimals)).ToString("N9") : totalCollectedToken1.ToString());

                return (totalCollectedToken0, totalCollectedToken1);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Raydium CLMM] Failed to fetch historical collected fees for position {Pda}", positionPda);
                return (0, 0);
            }
        }
        
        private bool ValidateApiFees(ulong feeToken0, ulong feeToken1)
        {
            const ulong MAX_REASONABLE_FEE = 1_000_000_000_000_000_000;

            if (feeToken0 > MAX_REASONABLE_FEE || feeToken1 > MAX_REASONABLE_FEE)
            {
                _logger.LogWarning($"[Raydium CLMM] API fees validation failed: values too large (Token0={feeToken0}, Token1={feeToken1})");
                return false;
            }

            return true;
        }

        /// <summary>
        /// Retries an RPC call with exponential backoff
        /// </summary>
        private async Task<T> RetryRpcCallAsync<T>(Func<Task<T>> operation, string operationName, int maxAttempts)
        {
            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    _logger.LogInformation("[Raydium CLMM] Attempting {Operation} query (attempt {Attempt}/{Max})", 
                        operationName, attempt, maxAttempts);
                    
                    var result = await operation();
                    
                    _logger.LogInformation("[Raydium CLMM] {Operation} query succeeded on attempt {Attempt}", 
                        operationName, attempt);
                    
                    return result;
                }
                catch (Exception ex)
                {
                    if (attempt == maxAttempts)
                    {
                        _logger.LogError(ex, "[Raydium CLMM] {Operation} query failed after {Attempts} attempts: {Message}", 
                            operationName, maxAttempts, ex.Message);
                        throw;
                    }
                    
                    var delayMs = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s
                    _logger.LogWarning(ex, "[Raydium CLMM] {Operation} query attempt {Attempt}/{Max} failed: {Message}. Retrying in {Delay}ms...", 
                        operationName, attempt, maxAttempts, ex.Message, delayMs);
                    
                    await Task.Delay(delayMs);
                }
            }
            
            throw new InvalidOperationException($"[Raydium CLMM] Retry logic for {operationName} failed unexpectedly");
        }

        private static decimal? FormatFeeTier(uint feeRate)
        {
            // Raydium stores fee rate in "hundredths of a bip" (10^-6)
            // e.g., 2500 = 0.25% (divide by 1000000 to get decimal percentage)
            // 400 = 0.04%
            if (feeRate == 0) return 0m;
            
            return feeRate / 1000000m;
        }

        private static string Short(string s) => string.IsNullOrEmpty(s) ? s : s[..6] + "…" + s[^4..];
    }
}
