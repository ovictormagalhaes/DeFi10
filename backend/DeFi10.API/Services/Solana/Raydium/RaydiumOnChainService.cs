using Microsoft.Extensions.Logging;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Models;
using DeFi10.API.Services.Models.Solana.Raydium;
using DeFi10.API.Services.Models.Solana.Common;
using DeFi10.API.Services.Solana.Raydium.Clmm.DTO;
using DeFi10.API.Services.Solana.Raydium.Clmm;
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

namespace DeFi10.API.Services.Solana.Raydium
{
    public class RaydiumOnChainService : IRaydiumOnChainService
    {
        private readonly IRpcClient _rpc;
        private readonly ILogger<RaydiumOnChainService> _logger;
        private readonly HttpClient _httpClient;
        private const string CLMM_PROGRAM_ID = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

        public RaydiumOnChainService(IRpcClient rpc, ILogger<RaydiumOnChainService> logger, HttpClient httpClient)
        {
            _rpc = rpc ?? throw new ArgumentNullException(nameof(rpc));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        }

        public async Task<List<RaydiumPosition>> GetPositionsAsync(string walletAddress)
        {
            var positions = new List<RaydiumPosition>();
            _logger.LogDebug($"[Raydium CLMM] GetPositions START wallet={walletAddress}");

            if (!PublicKey.IsValid(walletAddress))
            {
                _logger.LogError($"[Raydium CLMM] Invalid wallet address format: {walletAddress}");
                return positions;
            }

            const string TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
            
            _logger.LogDebug($"[Raydium CLMM] Querying SPL Token accounts...");
            var tokenAccountsResult = await _rpc.GetTokenAccountsByOwnerAsync(
                walletAddress, null, TokenProgram.ProgramIdKey, Commitment.Finalized);
            
            _logger.LogDebug($"[Raydium CLMM] Querying Token-2022 accounts...");
            var token2022AccountsResult = await _rpc.GetTokenAccountsByOwnerAsync(
                walletAddress, null, TOKEN_2022_PROGRAM, Commitment.Finalized);

            var allTokenAccounts = new List<TokenAccount>();
            
            if (tokenAccountsResult.WasSuccessful && tokenAccountsResult.Result?.Value != null)
            {
                allTokenAccounts.AddRange(tokenAccountsResult.Result.Value);
                _logger.LogDebug($"[Raydium CLMM] Found {tokenAccountsResult.Result.Value.Count} SPL Token accounts.");
            }
            else
            {
                _logger.LogWarning($"[Raydium CLMM] SPL Token query failed or returned null: {tokenAccountsResult?.ErrorData}");
            }
            
            if (token2022AccountsResult.WasSuccessful && token2022AccountsResult.Result?.Value != null)
            {
                allTokenAccounts.AddRange(token2022AccountsResult.Result.Value);
                _logger.LogDebug($"[Raydium CLMM] Found {token2022AccountsResult.Result.Value.Count} Token-2022 accounts.");
            }
            else
            {
                _logger.LogWarning($"[Raydium CLMM] Token-2022 query failed or returned null: success={token2022AccountsResult?.WasSuccessful}, error={token2022AccountsResult?.ErrorData}");
            }

            if (!allTokenAccounts.Any())
            {
                _logger.LogDebug($"[Raydium CLMM] No token accounts found for wallet {walletAddress}");
                return positions;
            }

            _logger.LogDebug($"[Raydium CLMM] Found {allTokenAccounts.Count} total token accounts for wallet {walletAddress}.");

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
                            _logger.LogDebug($"[Raydium CLMM] Token account: mint={mint}, amount={amount}, decimals={decimals}");
                            if (amount == 1 && decimals == 0)
                            {
                                positionNfts.Add(mint);
                                _logger.LogDebug($"[Raydium CLMM] Confirmed NFT mint={mint}");
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
                        _logger.LogDebug($"[Raydium CLMM] Token account {i}: owner={accInfo.Owner}, dataLen={rawData.Length}");
                        var tokenAccountData = SplTokenAccountLayout.Parse(rawData);
                        _logger.LogDebug($"[Raydium CLMM] Token account {i}: mint={tokenAccountData.Mint}, amount={tokenAccountData.Amount}");
                        if (tokenAccountData.Amount == 1)
                        {
                            potentialNftMints.Add(tokenAccountData.Mint);
                            _logger.LogDebug($"[Raydium CLMM] Potential NFT (Amount=1) mint={tokenAccountData.Mint}");
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
                                    _logger.LogDebug($"[Raydium CLMM] Confirmed NFT mint={mintAddr}");
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
                        _logger.LogDebug($"[Raydium CLMM] Derived ATA for mint={mint} ata={ata}");
                        var ataInfo = await _rpc.GetAccountInfoAsync(ata, Commitment.Finalized);
                        if (!ataInfo.WasSuccessful || ataInfo.Result.Value == null)
                        {
                            _logger.LogDebug($"[Raydium CLMM] ATA not found for mint={mint}");
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
                            _logger.LogDebug($"[Raydium CLMM] Mint account missing for fallback mint={mint}");
                            continue;
                        }
                        try
                        {
                            var mintRaw = Convert.FromBase64String(mintInfo.Result.Value.Data[0]);
                            var md = SplMintAccountLayout.Parse(mintRaw);
                            _logger.LogDebug($"[Raydium CLMM] Fallback mint={mint} amount={ataParsed.Amount} decimals={md.Decimals}");
                            if (ataParsed.Amount == 1 && md.Decimals == 0)
                            {
                                positionNfts.Add(mint);
                                _logger.LogDebug($"[Raydium CLMM] Added fallback NFT mint={mint}");
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

            if (!positionNfts.Any())
            {
                _logger.LogDebug($"[Raydium CLMM] No position NFTs after fallback. END wallet={walletAddress}");
                return positions;
            }

            var positionPdas = positionNfts.Select(DerivePositionPdaFromNftMint).Where(p => p != null).ToList();
            if (!positionPdas.Any())
            {
                _logger.LogDebug("[Raydium CLMM] No PDAs derived from NFTs.");
                return positions;
            }

            var posAccounts = await _rpc.GetMultipleAccountsAsync(positionPdas, Commitment.Finalized);
            if (!posAccounts.WasSuccessful)
            {
                _logger.LogError($"[Raydium CLMM] GetMultipleAccountsAsync for position PDAs failed: {posAccounts.ErrorData}");
                return positions;
            }
            _logger.LogDebug($"[Raydium CLMM] Retrieved {posAccounts.Result.Value.Count(v => v != null)} position account(s).");

            foreach (var acc in posAccounts.Result.Value.Where(v => v != null))
            {
                try
                {
                    var layoutBytes = Convert.FromBase64String(acc.Data[0]);
                    _logger.LogDebug($"[Raydium CLMM] Position account data length: {layoutBytes.Length} bytes");
                    _logger.LogDebug($"[Raydium CLMM] Position account hex (first 200 bytes): {BitConverter.ToString(layoutBytes.Take(Math.Min(200, layoutBytes.Length)).ToArray())}");
                    
                    var layout = ClmmPositionDTO.Parse(layoutBytes);
                    _logger.LogDebug($"[Raydium CLMM] Position NFT={layout.NftMint} pool={layout.PoolId} liq={layout.Liquidity}");

                    var poolInfo = await _rpc.GetAccountInfoAsync(layout.PoolId, Commitment.Finalized);
                    if (!poolInfo.WasSuccessful || poolInfo.Result.Value == null)
                    {
                        _logger.LogWarning($"[Raydium CLMM] Pool account missing poolId={layout.PoolId}");
                        continue;
                    }

                    var poolBytes = Convert.FromBase64String(poolInfo.Result.Value.Data[0]);
                    var pool = ClmmPoolDTO.Parse(poolBytes, layout.PoolId);
                    _logger.LogDebug($"[Raydium CLMM] Pool parsed tokenA={pool.TokenMintA} tokenB={pool.TokenMintB} tickCurrent={pool.TickCurrent} liquidity={pool.Liquidity} tickSpacing={pool.TickSpacing}");
                    _logger.LogDebug($"[Raydium CLMM] Pool fee growth: Global0={pool.FeeGrowthGlobal0X64}, Global1={pool.FeeGrowthGlobal1X64}");

                    if (layout.Liquidity == 0)
                    {
                        _logger.LogDebug($"[Raydium CLMM] Position NFT={layout.NftMint} has zero liquidity; skipping.");
                        continue;
                    }

                    var amounts = GetAmounts(layout, pool);
                    var tokenAAmount = (decimal)amounts.AmountA;
                    var tokenBAmount = (decimal)amounts.AmountB;
                    _logger.LogDebug($"[Raydium CLMM] Computed amounts tokenA={tokenAAmount} tokenB={tokenBAmount}");

                    var tokenADecimals = await GetTokenDecimals(pool.TokenMintA);
                    var tokenBDecimals = await GetTokenDecimals(pool.TokenMintB);
                    _logger.LogDebug($"[Raydium CLMM] Token decimals: tokenA={tokenADecimals}, tokenB={tokenBDecimals}");
                    
                    _logger.LogDebug($"[Raydium CLMM] Uncollected fees: FeesOwedTokenA={layout.FeesOwedTokenA}, FeesOwedTokenB={layout.FeesOwedTokenB}");
                    _logger.LogDebug($"[Raydium CLMM] Fee growth inside last: A={layout.FeeGrowthInsideA}, B={layout.FeeGrowthInsideB}");
                    _logger.LogDebug($"[Raydium CLMM] Position: tickLower={layout.TickLower}, tickUpper={layout.TickUpper}, liquidity={layout.Liquidity}");
                    
                    for (int i = 0; i < layout.RewardInfos.Length; i++)
                    {
                        var reward = layout.RewardInfos[i];
                        _logger.LogDebug($"[Raydium CLMM] Reward[{i}]: AmountOwed={reward.RewardAmountOwed}, GrowthInside={reward.GrowthInsideLastX64}");
                    }
                    
                    ulong finalFeeToken0 = layout.FeesOwedTokenA;
                    ulong finalFeeToken1 = layout.FeesOwedTokenB;
                    
                    _logger.LogDebug($"[Raydium CLMM] Using tokenFeesOwed: Token0={finalFeeToken0}, Token1={finalFeeToken1}");
                    
                    var tokenList = new List<SplToken>
                    {
                        new SplToken { Mint = pool.TokenMintA, Amount = tokenAAmount, Decimals = tokenADecimals, Type = TokenType.Supplied },
                        new SplToken { Mint = pool.TokenMintB, Amount = tokenBAmount, Decimals = tokenBDecimals, Type = TokenType.Supplied }
                    };
                    
                    if (finalFeeToken0 > 0)
                    {
                        tokenList.Add(new SplToken 
                        { 
                            Mint = pool.TokenMintA, 
                            Amount = finalFeeToken0, 
                            Decimals = tokenADecimals, 
                            Type = TokenType.LiquidityUncollectedFee 
                        });
                        _logger.LogDebug($"[Raydium CLMM] Added uncollected fee token A: {finalFeeToken0}");
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
                        _logger.LogDebug($"[Raydium CLMM] Added uncollected fee token B: {finalFeeToken1}");
                    }
                    
                    positions.Add(new RaydiumPosition
                    {
                        Pool = $"{Short(pool.TokenMintA)}-{Short(pool.TokenMintB)}",
                        Tokens = tokenList,
                        TotalValueUsd = 0,
                        SqrtPriceX96 = pool.SqrtPriceX64.ToString(),
                        TickLower = layout.TickLower,
                        TickUpper = layout.TickUpper,
                        TickCurrent = pool.TickCurrent
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Raydium CLMM] Failed parsing position account.");
                }
            }

            _logger.LogDebug($"[Raydium CLMM] GetPositions DONE wallet={walletAddress} positions={positions.Count}");
            return positions;
        }

        private (BigInteger AmountA, BigInteger AmountB) GetAmounts(ClmmPositionDTO position, ClmmPoolDTO pool)
        {
            var liquidity = position.Liquidity;
            var currentTick = pool.TickCurrent;
            var lowerTick = position.TickLower;
            var upperTick = position.TickUpper;

            _logger.LogDebug($"[Raydium CLMM] GetAmounts: liquidity={liquidity}, currentTick={currentTick}, lowerTick={lowerTick}, upperTick={upperTick}");

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

                _logger.LogDebug($"[Raydium CLMM] Calculated amounts: AmountA={amountA}, AmountB={amountB}");
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

            _logger.LogDebug($"[Raydium CLMM] Derived PDA: NFT={nftMint}, PDA={pda.Key}");
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
                        _logger.LogDebug($"[Raydium CLMM] Trying API endpoint: {endpoint}");
                        
                        var response = await _httpClient.GetAsync(endpoint);
                        
                        _logger.LogDebug($"[Raydium CLMM] API response status: {response.StatusCode}");
                        
                        if (!response.IsSuccessStatusCode)
                        {
                            var errorBody = await response.Content.ReadAsStringAsync();
                            _logger.LogWarning($"[Raydium CLMM] API returned status: {response.StatusCode}, body: {errorBody}");
                            continue;
                        }

                        var json = await response.Content.ReadAsStringAsync();
                        _logger.LogDebug($"[Raydium CLMM] API response body (full): {json}");
                        
                        if (string.IsNullOrWhiteSpace(json))
                        {
                            _logger.LogWarning($"[Raydium CLMM] API returned empty response");
                            continue;
                        }
                        
                        var apiData = System.Text.Json.JsonDocument.Parse(json);
                        
                        _logger.LogDebug($"[Raydium CLMM] Parsed JSON, checking for 'data' property...");
                        
                        if (apiData.RootElement.TryGetProperty("data", out var data))
                        {
                            _logger.LogDebug($"[Raydium CLMM] Found 'data' property, trying to extract fees...");
                            if (TryExtractFeesFromApiData(data, out var fees))
                            {
                                _logger.LogDebug($"[Raydium CLMM] Extracted fees from 'data': Token0={fees.feeToken0}, Token1={fees.feeToken1}");
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
                            _logger.LogDebug($"[Raydium CLMM] Extracted fees from root: Token0={fees2.feeToken0}, Token1={fees2.feeToken1}");
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



        private static string Short(string s) => string.IsNullOrEmpty(s) ? s : s[..6] + "�" + s[^4..];
    }
}
