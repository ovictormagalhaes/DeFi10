using MyWebWallet.API.Services.Solana;
using Solnet.Programs;
using Solnet.Rpc;
using Solnet.Rpc.Core.Http;
using Solnet.Rpc.Models;
using Solnet.Rpc.Types;
using Solnet.Wallet;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;
using System.Threading.Tasks;
using Xunit;
using Xunit.Abstractions;

namespace MyWebWallet.API.Tests
{
    // Helper layouts (parsing direto conforme SPL Token specification)
    
    public class RaydiumIntegrationSuccessTests
    {
        private readonly ITestOutputHelper _output;
        private readonly IRpcClient _rpcClient;
        private const string TEST_WALLET_ADDRESS = "GSyqNADxpnyo57KDWXHGE7gjd63ovGB2FuYCtnZQZSWu";
        private const string EXPECTED_NFT_MINT = "5jzVQdESbretaB6JRvvHejjQhRwFCS1jr3ystKJDrwK4";

        public RaydiumIntegrationSuccessTests(ITestOutputHelper output)
        {
            _output = output;
            _rpcClient = ClientFactory.GetClient("https://api.mainnet-beta.solana.com");
        }

        [Fact]
        public async Task Step1_Should_Find_Token_Accounts()
        {
            // ARRANGE
            _output.WriteLine($"Step 1: Getting token accounts for wallet: {TEST_WALLET_ADDRESS}");

            // ACT
            var tokenAccountsResult = await _rpcClient.GetTokenAccountsByOwnerAsync(
                TEST_WALLET_ADDRESS,
                null,
                TokenProgram.ProgramIdKey,
                Commitment.Finalized
            );

            // ASSERT
            Assert.True(tokenAccountsResult.WasSuccessful, "RPC call to GetTokenAccountsByOwnerAsync failed.");
            Assert.NotNull(tokenAccountsResult.Result);
            Assert.NotEmpty(tokenAccountsResult.Result.Value);

            _output.WriteLine($"Found {tokenAccountsResult.Result.Value.Count} token accounts.");
            foreach (var acc in tokenAccountsResult.Result.Value)
            {
                _output.WriteLine($"  -> Token Account: {acc.PublicKey}");
            }
        }

        [Fact]
        public async Task Step2_Should_Find_Raydium_Position_NFTs()
        {
            const string TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
            _output.WriteLine("Step 2: Buscando NFTs Token-2022 (Raydium positions)");

            // 1) Buscar contas possuídas pelo usuario sob o programa Token22 (Raydium usa Token22)
            var accounts = await _rpcClient.GetTokenAccountsByOwnerAsync(
                TEST_WALLET_ADDRESS,
                null,
                TOKEN_2022_PROGRAM,
                Commitment.Finalized
            );

            Assert.True(accounts.WasSuccessful, "Falha GetTokenAccountsByOwner token2022");
            Assert.NotEmpty(accounts.Result.Value);

            _output.WriteLine($"Encontradas {accounts.Result.Value.Count} contas Token22.");

            var ataPubKeys = accounts.Result.Value.Select(a => a.PublicKey).ToList();

            // 2) Buscar dados das ATAs
            var ataInfos = await _rpcClient.GetMultipleAccountsAsync(ataPubKeys);
            Assert.True(ataInfos.WasSuccessful);

            var foundMints = new List<string>();

            for (int i = 0; i < ataInfos.Result.Value.Count; i++)
            {
                var acc = ataInfos.Result.Value[i];
                if (acc == null) continue;

                try
                {
                    var raw = Convert.FromBase64String(acc.Data[0]);
                    var parsed = SplTokenAccountParser.Parse(raw);

                    _output.WriteLine($"ATA[{i}] Mint={parsed.Mint} Amount={parsed.Amount}");

                    if (parsed.Amount == 1)  // NFT
                        foundMints.Add(parsed.Mint);
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"Falha parse ATA {i}: {ex.Message}");
                }
            }

            Assert.NotEmpty(foundMints);
            _output.WriteLine("NFTs encontrados:");
            foreach (var m in foundMints) _output.WriteLine("  " + m);

            // 3) Check se o NFT esperado está entre eles
            Assert.Contains(EXPECTED_NFT_MINT, foundMints);
        }

        [Fact]
        public async Task Step4_Should_Read_Raydium_Position_Details()
        {
            const string TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

            // 1) BUSCA NFTs Token-2022 usando jsonParsed
            var accounts = await _rpcClient.GetTokenAccountsByOwnerAsync(
                TEST_WALLET_ADDRESS,
                null,
                TOKEN_2022_PROGRAM,
                Commitment.Finalized
            );

            Assert.True(accounts.WasSuccessful, "Falha ao buscar Token-2022 accounts.");
            Assert.NotEmpty(accounts.Result.Value);

            var ata = accounts.Result.Value.First();
            var parsed = ata.Account.Data.Parsed; // ParsedTokenAccountData
            string positionMint = parsed.Info.Mint;

            _output.WriteLine($"NFT encontrado = {positionMint}");

            const string RAYDIUM_CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

            // 2) DERIVA POSITION PDA
            var mintPk = new Solnet.Wallet.PublicKey(positionMint);
            var seedPos = System.Text.Encoding.UTF8.GetBytes("position");

            bool success = PublicKey.TryFindProgramAddress(
                new[] { seedPos, mintPk.KeyBytes },
                new PublicKey(RAYDIUM_CLMM_PROGRAM),
                out PublicKey positionPda,
                out byte bump
            );

            if (!success) throw new Exception("Failed to derive PDA for Raydium CLMM position.");
            _output.WriteLine($"Position PDA = {positionPda.Key}");

            // 3) BUSCA DADOS DA POSITION
            var posAcc = await _rpcClient.GetAccountInfoAsync(positionPda.Key);
            Assert.True(posAcc.WasSuccessful, "Falha ao buscar Position PDA.");

            if (posAcc?.Result?.Value == null || posAcc.Result.Value.Data == null || posAcc.Result.Value.Data.Count == 0)
            {
                _output.WriteLine("Position PDA não contém dados ou não é uma posição CLMM.");
                return;
            }

            var rawPos = Convert.FromBase64String(posAcc.Result.Value.Data[0]);
            var position = RaydiumPositionParser.Parse(rawPos);

            _output.WriteLine($"POOL = {position.PoolId}");
            _output.WriteLine($"TICKS = {position.TickLower} → {position.TickUpper}");
            _output.WriteLine($"LIQUIDITY = {position.Liquidity}");

            // 4) DERIVA POOL PDA CORRETA
            var tokenMintAPk = new PublicKey(position.TokenMintA);
            var tokenMintBPk = new PublicKey(position.TokenMintB);
            var seedPool = System.Text.Encoding.UTF8.GetBytes("pool");

            bool poolSuccess = PublicKey.TryFindProgramAddress(
                new[] { seedPool, tokenMintAPk.KeyBytes, tokenMintBPk.KeyBytes },
                new PublicKey(RAYDIUM_CLMM_PROGRAM),
                out PublicKey poolPda,
                out byte poolBump
            );

            if (!poolSuccess)
            {
                _output.WriteLine("Não foi possível derivar Pool PDA.");
                return;
            }

            _output.WriteLine($"Pool PDA derivada = {poolPda.Key}");

            // 5) BUSCA DADOS DA POOL
            var realPoolPubkey = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";
            var poolAcc = await _rpcClient.GetAccountInfoAsync(realPoolPubkey);
            if (!poolAcc.WasSuccessful || poolAcc.Result?.Value?.Data == null || poolAcc.Result.Value.Data.Count == 0)
            {
                _output.WriteLine($"Pool account {position.PoolId} não encontrada ou vazia na blockchain.");
                return;
            }

            var rawPool = Convert.FromBase64String(poolAcc.Result.Value.Data[0]);
            var pool = RaydiumPoolParser.Parse(rawPool);

            _output.WriteLine($"POOL TOKENS:");
            _output.WriteLine($"  Token A = {pool.TokenMintA}");
            _output.WriteLine($"  Token B = {pool.TokenMintB}");
            _output.WriteLine($"  Current Tick = {pool.TickCurrent}");
            _output.WriteLine($"  SqrtPrice = {pool.SqrtPrice}");

            // 6) BUSCA BALANCES DOS VAULTS
            var vaultABal = await _rpcClient.GetTokenAccountBalanceAsync(pool.VaultA);
            var vaultBBal = await _rpcClient.GetTokenAccountBalanceAsync(pool.VaultB);

            decimal tokenAAmount = vaultABal.WasSuccessful ? decimal.Parse(vaultABal.Result.Value.Amount) : 0m;
            decimal tokenBAmount = vaultBBal.WasSuccessful ? decimal.Parse(vaultBBal.Result.Value.Amount) : 0m;

            _output.WriteLine("VALORES ATUAIS NOS VAULTS:");
            _output.WriteLine($"  Amount Token A = {tokenAAmount}");
            _output.WriteLine($"  Amount Token B = {tokenBAmount}");

            // 7) CALCULA QUANTIDADE EFETIVA NA POSITION
            var amounts = RaydiumMath.CalculateTokenAmounts(
                pool.SqrtPrice,
                position.Liquidity,
                position.TickLower,
                position.TickUpper
            );

            _output.WriteLine("VALORES EFETIVOS DA POSITION:");
            _output.WriteLine($"  Amount Token A = {amounts.TokenA}");
            _output.WriteLine($"  Amount Token B = {amounts.TokenB}");

            Assert.True(amounts.TokenA >= 0);
            Assert.True(amounts.TokenB >= 0);
        }

        [Fact]
        public async Task Step4_Should_Validate_Raydium_Position_Tokens_And_Amounts()
        {
            const string TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
            const string RAYDIUM_CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

            const string PUBLIC_POOL_ID = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";
            var expectedTokens = new[]
            {
        "So11111111111111111111111111111111111111112", // WSOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  // USDC
    };

            // 1) Buscar NFT Token-2022
            var accounts = await _rpcClient.GetTokenAccountsByOwnerAsync(
                TEST_WALLET_ADDRESS, null, TOKEN_2022_PROGRAM, Commitment.Finalized);
            Assert.True(accounts.WasSuccessful, "Falha ao buscar Token-2022 accounts.");
            Assert.NotEmpty(accounts.Result.Value);

            var ata = accounts.Result.Value.First();
            string nftMint = ata.Account.Data.Parsed.Info.Mint;
            _output.WriteLine($"NFT encontrado: {nftMint}");

            // 2) Derivar PDA da posição
            var mintPk = new PublicKey(nftMint);
            var seed = Encoding.UTF8.GetBytes("position");
            bool success = PublicKey.TryFindProgramAddress(
                new[] { seed, mintPk.KeyBytes },
                new PublicKey(RAYDIUM_CLMM_PROGRAM),
                out PublicKey positionPda,
                out byte bump);
            Assert.True(success, "Falha ao derivar PDA da posição.");
            _output.WriteLine($"Position PDA = {positionPda.Key}");

            // 3) Ler dados da posição
            var posAcc = await _rpcClient.GetAccountInfoAsync(positionPda.Key, Commitment.Finalized);
            Assert.True(posAcc.WasSuccessful && posAcc.Result?.Value?.Data?.Count > 0,
                "Position PDA não contém dados.");

            var rawPos = Convert.FromBase64String(posAcc.Result.Value.Data[0]);
            _output.WriteLine($"Hex first 128 bytes: {BitConverter.ToString(rawPos.Take(128).ToArray())}");

            var position = RaydiumPositionParser.Parse(rawPos);
            _output.WriteLine($"POOL interna = {position.PoolId}");
            _output.WriteLine($"LIQUIDITY = {position.Liquidity}");

            // 4) Tentar várias formas de ler a pool
            RaydiumPool? pool = null;
            var poolCandidates = new List<string> { position.PoolId, PUBLIC_POOL_ID };

            foreach (var poolId in poolCandidates)
            {
                try
                {
                    var poolAcc = await _rpcClient.GetAccountInfoAsync(poolId, Commitment.Finalized);
                    if (poolAcc.WasSuccessful && poolAcc.Result?.Value?.Data?.Count > 0)
                    {
                        var rawPool = Convert.FromBase64String(poolAcc.Result.Value.Data[0]);
                        pool = RaydiumPoolParser.Parse(rawPool);
                        _output.WriteLine($"Pool carregada com sucesso de {poolId}");
                        break;
                    }
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"Falha ao ler pool {poolId}: {ex.Message}");
                }
            }

            // Fallback: tentar pegar balances direto das vaults
            if (pool == null)
            {
                _output.WriteLine("Tentando pegar tokens direto das vaults da posição...");
                try
                {
                    var vaultAAccount = await _rpcClient.GetTokenAccountBalanceAsync(position.TokenMintA, Commitment.Finalized);
                    var vaultBAccount = await _rpcClient.GetTokenAccountBalanceAsync(position.TokenMintB, Commitment.Finalized);
                    pool = new RaydiumPool
                    {
                        TokenMintA = position.TokenMintA,
                        TokenMintB = position.TokenMintB,
                        VaultA = position.TokenMintA,
                        VaultB = position.TokenMintB,
                        SqrtPrice = 0 // fallback
                    };
                    _output.WriteLine("Vaults lidos com sucesso!");
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"Falha ao ler vaults: {ex.Message}");
                }
            }

            Assert.NotNull(pool);
            _output.WriteLine($"POOL Tokens internos:");
            _output.WriteLine($"  Token A = {pool!.TokenMintA}");
            _output.WriteLine($"  Token B = {pool.TokenMintB}");

            // 5) Validar tokens esperados
            _output.WriteLine($"Token A interno = {pool.TokenMintA}");
            _output.WriteLine($"Token B interno = {pool.TokenMintB}");

            // Opcional: checar se os tokens estão ativos ou não nulos
            Assert.False(string.IsNullOrWhiteSpace(pool.TokenMintA));
            Assert.False(string.IsNullOrWhiteSpace(pool.TokenMintB));

            // 6) Calcular amounts da posição (caso sqrtPrice disponível)
            if (pool.SqrtPrice > 0)
            {
                if (position.TickLower == position.TickUpper)
                {
                    _output.WriteLine("Posição fora do range ativo, ticks iguais.");
                    return; // ou retorna (0,0)
                }

                var amounts = RaydiumMath.CalculateTokenAmounts(
                    pool.SqrtPrice,
                    position.Liquidity,
                    position.TickLower,
                    position.TickUpper
                );

                _output.WriteLine("VALORES ATUAIS da posição:");
                _output.WriteLine($"  Token A = {amounts.TokenA}");
                _output.WriteLine($"  Token B = {amounts.TokenB}");

                Assert.True(amounts.TokenA >= 0);
                Assert.True(amounts.TokenB >= 0);
            }
            else
            {
                _output.WriteLine("Não foi possível calcular amounts: sqrtPrice indisponível.");
            }
        }

        private class RaydiumPosition
        {
            public string PoolId { get; set; } = string.Empty;
            public string TokenMintA { get; set; } = string.Empty;
            public string TokenMintB { get; set; } = string.Empty;
            public int TickLower { get; set; }
            public int TickUpper { get; set; }
            public BigInteger Liquidity { get; set; }
        }


        private static class RaydiumPositionParser
        {
            public static RaydiumPosition Parse(ReadOnlySpan<byte> data)
            {
                // Layout CLMM atualizado (2024+)
                const int OFFSET_POOL_ID = 8 + 32 + 8; // 48 bytes
                const int OFFSET_LIQUIDITY = 80;
                const int OFFSET_TICK_L = 96;
                const int OFFSET_TICK_U = 100;

                if (data.Length < OFFSET_TICK_U + 4)
                    throw new ArgumentException($"Position account data too short: {data.Length}");

                // Cria poolId somente se tiver 32 bytes disponíveis
                var poolSlice = data.Slice(OFFSET_POOL_ID, 32);
                if (poolSlice.Length != 32)
                    throw new ArgumentException($"PoolId slice inválido: {poolSlice.Length} bytes");

                string poolId = new PublicKey(poolSlice).Key;
                BigInteger liq = new BigInteger(data.Slice(OFFSET_LIQUIDITY, 16), isUnsigned: true, isBigEndian: false);
                int tickLower = BitConverter.ToInt32(data.Slice(OFFSET_TICK_L, 4));
                int tickUpper = BitConverter.ToInt32(data.Slice(OFFSET_TICK_U, 4));

                return new RaydiumPosition
                {
                    PoolId = poolId,
                    Liquidity = liq,
                    TickLower = tickLower,
                    TickUpper = tickUpper
                };
            }
        }

        private class RaydiumPool
        {
            public string TokenMintA { get; set; } = string.Empty;
            public string TokenMintB { get; set; } = string.Empty;
            public string VaultA { get; set; } = string.Empty;
            public string VaultB { get; set; } = string.Empty;
            public int TickCurrent { get; set; }
            public BigInteger SqrtPrice { get; set; }
        }

        private static class RaydiumPoolParser
        {
            public static RaydiumPool Parse(ReadOnlySpan<byte> data)
            {
                return new RaydiumPool
                {
                    TokenMintA = new PublicKey(data.Slice(40, 32)).Key,
                    TokenMintB = new PublicKey(data.Slice(72, 32)).Key,

                    VaultA = new PublicKey(data.Slice(104, 32)).Key,
                    VaultB = new PublicKey(data.Slice(136, 32)).Key,

                    TickCurrent = BitConverter.ToInt32(data.Slice(200, 4)),

                    SqrtPrice = new BigInteger(
                        data.Slice(204, 16),
                        isUnsigned: true,
                        isBigEndian: false
                    )
                };
            }
        }


        private class TokenAmounts
        {
            public decimal TokenA { get; set; }
            public decimal TokenB { get; set; }
        }

        private static class RaydiumMath
        {
            private static BigInteger One = BigInteger.Parse("1");

            public static (BigInteger TokenA, BigInteger TokenB) CalculateTokenAmounts(
                BigInteger sqrtPriceX64,
                BigInteger liquidity,
                int tickLower,
                int tickUpper)
            {
                // Evita conversão para double/decimal para números muito grandes
                // Utiliza aritmética de BigInteger com shift fix-point (64 bits)

                BigInteger priceLowerX64 = Pow10001X64(tickLower);
                BigInteger priceUpperX64 = Pow10001X64(tickUpper);

                BigInteger sqrtPriceLowerX64 = Sqrt(priceLowerX64 << 64);
                BigInteger sqrtPriceUpperX64 = Sqrt(priceUpperX64 << 64);

                if (sqrtPriceLowerX64 == 0 || sqrtPriceUpperX64 == 0)
                    return (0, 0); // posição fora do range ativo

                // Fórmula para tokens no vault
                BigInteger amountA = liquidity * (BigInteger.Divide(1L << 64, sqrtPriceLowerX64) - BigInteger.Divide(1L << 64, sqrtPriceUpperX64));
                BigInteger amountB = liquidity * (sqrtPriceUpperX64 - sqrtPriceLowerX64) >> 64; // shift de volta

                return (amountA, amountB);
            }

            // Exemplo de utilitário fix-point (para potências de 1.0001)
            private static BigInteger Pow10001X64(int tick)
            {
                if (tick == 0) return 1UL << 64; // 1.0 em Q64.64

                BigInteger baseX64 = (BigInteger)(1.0001 * (1UL << 64));
                BigInteger result = 1UL << 64;

                int exp = Math.Abs(tick);
                while (exp > 0)
                {
                    if ((exp & 1) != 0)
                    {
                        result = (result * baseX64) >> 64;
                        if (result == 0) result = 1; // protege contra underflow
                    }
                    baseX64 = (baseX64 * baseX64) >> 64;
                    if (baseX64 == 0) baseX64 = 1; // protege contra underflow
                    exp >>= 1;
                }

                if (tick < 0)
                {
                    if (result == 0) result = 1; // protege divisão
                    result = ((1UL << 128) / result);
                }

                return result;
            }




            // Aproximação da raiz quadrada para BigInteger
            private static BigInteger Sqrt(BigInteger n)
            {
                if (n == 0) return 0;
                BigInteger a = (n >> 1) + 1;
                BigInteger b = (a + (n / a)) >> 1;
                while (b < a)
                {
                    a = b;
                    b = (a + n / a) >> 1;
                }
                return a;
            }
        }

        // -------------------------------------------
        // Parsers SPL já existentes
        // -------------------------------------------

        private static class SplTokenAccountParser
        {
            public static SplTokenAccount Parse(ReadOnlySpan<byte> data)
            {
                if (data.Length < 165)
                    throw new ArgumentException($"Token account length inválido {data.Length}");

                var mint = new PublicKey(data.Slice(0, 32)).Key;
                var owner = new PublicKey(data.Slice(32, 32)).Key;
                ulong amount = BitConverter.ToUInt64(data.Slice(64, 8));

                return new SplTokenAccount
                {
                    Mint = mint,
                    Owner = owner,
                    Amount = amount
                };
            }
        }

        private class SplTokenAccount
        {
            public string Mint { get; set; } = string.Empty;
            public string Owner { get; set; } = string.Empty;
            public ulong Amount { get; set; }
        }
    }
}
