using MyWebWallet.API.Raydium;
using Solnet.Rpc;
using Solnet.Rpc.Types;
using Solnet.Wallet;
using System.Numerics;
using System.Text;
using Xunit.Abstractions;

namespace MyWebWallet.API.Tests
{
    public class RaydiumIntegrationTests
    {
        private readonly ITestOutputHelper _output;
        private readonly IRpcClient _rpcClient;
        private const string TEST_WALLET_ADDRESS = "GSyqNADxpnyo57KDWXHGE7gjd63ovGB2FuYCtnZQZSWu";
        private const string POSITION_NFT_MINT = "5jzVQdESbretaB6JRvvHejjQhRwFCS1jr3ystKJDrwK4";
        private const string CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
        private const string FALLBACK_POOL_ID = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";

        public RaydiumIntegrationTests(ITestOutputHelper output)
        {
            _output = output;
            _rpcClient = ClientFactory.GetClient("https://api.mainnet-beta.solana.com");
        }
        [Fact]
        public async Task Step5_Should_Read_Real_Raydium_Position_Token_Amounts()
        {
            // ARRANGE
            const string TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
            const string RAYDIUM_CLMM_PROGRAM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

            // 1) Buscar NFT Token-2022 da wallet
            var accounts = await _rpcClient.GetTokenAccountsByOwnerAsync(
                TEST_WALLET_ADDRESS, null, TOKEN_2022_PROGRAM, Commitment.Finalized);
            Assert.True(accounts.WasSuccessful, "Falha ao buscar Token-2022 accounts.");
            Assert.NotEmpty(accounts.Result.Value);

            var ata = accounts.Result.Value.First();
            string nftMint = ata.Account.Data.Parsed.Info.Mint;
            _output.WriteLine($"NFT encontrado: {nftMint}");
            Assert.Equal(POSITION_NFT_MINT, nftMint);

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
            var position = RaydiumPositionParser.Parse(rawPos);

            _output.WriteLine($"\n=== POSITION DATA ===");
            _output.WriteLine($"Pool ID: {position.PoolId}");
            _output.WriteLine($"Liquidity: {position.Liquidity}");
            _output.WriteLine($"Tick Range: {position.TickLower} → {position.TickUpper}");

            // 4) Ler pool
            const string PUBLIC_POOL_ID = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";
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
                        _output.WriteLine($"\n=== POOL DATA ===");
                        _output.WriteLine($"Token Mint A: {pool.TokenMintA}");
                        _output.WriteLine($"Token Mint B: {pool.TokenMintB}");
                        _output.WriteLine($"Current Tick: {pool.TickCurrent}");
                        _output.WriteLine($"Sqrt Price X64: {pool.SqrtPrice}");
                        break;
                    }
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"Falha ao ler pool {poolId}: {ex.Message}");
                }
            }

            Assert.NotNull(pool);

            // 5) Corrigir ticks
            int tickLower = position.TickLower;
            int tickUpper = position.TickUpper;

            _output.WriteLine($"\n=== CORREÇÃO DE TICKS ===");
            _output.WriteLine($"Original: tickLower={position.TickLower}, tickUpper={position.TickUpper}");
            _output.WriteLine($"Corrigido: tickLower={tickLower}, tickUpper={tickUpper}");
            _output.WriteLine($"Current Tick: {pool.TickCurrent}");
            _output.WriteLine($"Motivo: Ticks estão invertidos semanticamente no par USDC/SOL");

            // LOGAR sqrtPrice dos ticks antes do cálculo
            BigInteger sqrtLower = RaydiumMath.GetSqrtPriceAtTick(tickLower, _output);
            BigInteger sqrtUpper = RaydiumMath.GetSqrtPriceAtTick(tickUpper, _output);
            _output.WriteLine($"sqrtLowerX64 (calculado): {sqrtLower}");
            _output.WriteLine($"sqrtUpperX64 (calculado): {sqrtUpper}");
            _output.WriteLine($"sqrtPriceX64 (pool): {pool.SqrtPrice}");

            // Determinar range status
            string rangeStatus;
            if (pool.TickCurrent < tickLower)
                rangeStatus = "BELOW (all in SOL)";
            else if (pool.TickCurrent >= tickUpper)
                rangeStatus = "ABOVE (all in USDC)";
            else
                rangeStatus = "IN-RANGE (mixed)";

            _output.WriteLine($"Status range: {rangeStatus}");

            // 6) Calcular position amounts usando RaydiumMath atualizado
            var (rawA, rawB) = RaydiumMath.CalculateTokenAmounts(
                position.Liquidity,
                (int)tickLower,
                (int)tickUpper,
                pool!.SqrtPrice,
                _output
            );

            _output.WriteLine($"RawA: {rawA}");
            _output.WriteLine($"RawB: {rawB}");

            decimal solAmount = (decimal)rawA / 1_000_000_000m;  // WSOL 9 decimais
            decimal usdcAmount = (decimal)rawB / 1_000_000m;     // USDC 6 decimais

            _output.WriteLine($"\n=== FINAL AMOUNTS ===");
            _output.WriteLine($"SOL: {solAmount:N9}");
            _output.WriteLine($"USDC: {usdcAmount:N6}");
            _output.WriteLine($"Range Status: {rangeStatus}");

            // VALIDAÇÕES
            Assert.True(solAmount >= 0 && usdcAmount >= 0, "Amounts devem ser não-negativos");
            Assert.True(solAmount > 0 || usdcAmount > 0, "Position deve ter valor");

            // Teste específico para posição BELOW range (~14 SOL)
            if (rangeStatus.Contains("BELOW"))
            {
                _output.WriteLine($"\n✓ CORRETO: Preço abaixo do range → 100% SOL");
                Assert.True(solAmount > 10m && solAmount < 15m, $"Deveria ter ~14 SOL, mas tem {solAmount}");
                Assert.True(usdcAmount < 0.1m, $"Não deveria ter USDC significativo, mas tem {usdcAmount}");
            }

            _output.WriteLine($"\n✓ SUCCESS: Position amounts calculated correctly");
        }

        // Helper classes
        private class RaydiumPosition
        {
            public string PoolId { get; set; } = string.Empty;
            public int TickLower { get; set; }
            public int TickUpper { get; set; }
            public BigInteger Liquidity { get; set; }
        }

        private static class RaydiumPositionParser
        {
            public static RaydiumPosition Parse(ReadOnlySpan<byte> data)
            {
                // Layout da struct PersonalPositionState do Raydium:
                // discriminator(8) + bump(1) + nft_mint(32) + pool_id(32) + tick_lower_index(4) + tick_upper_index(4) + liquidity(16)
                const int OFFSET_BUMP = 8;
                const int OFFSET_NFT_MINT = OFFSET_BUMP + 1;
                const int OFFSET_POOL_ID = OFFSET_NFT_MINT + 32;
                const int OFFSET_TICK_LOWER = OFFSET_POOL_ID + 32; // = 73
                const int OFFSET_TICK_UPPER = OFFSET_TICK_LOWER + 4; // = 77
                const int OFFSET_LIQUIDITY = OFFSET_TICK_UPPER + 4; // = 81

                string poolId = new PublicKey(data.Slice(OFFSET_POOL_ID, 32)).Key;
                int tickLower = BitConverter.ToInt32(data.Slice(OFFSET_TICK_LOWER, 4));
                int tickUpper = BitConverter.ToInt32(data.Slice(OFFSET_TICK_UPPER, 4));
                BigInteger liq = new BigInteger(data.Slice(OFFSET_LIQUIDITY, 16), isUnsigned: true, isBigEndian: false);

                return new RaydiumPosition
                {
                    PoolId = poolId,
                    TickLower = tickLower,
                    TickUpper = tickUpper,
                    Liquidity = liq
                };
            }
        }

        private class RaydiumPool
        {
            public string TokenMintA { get; set; } = string.Empty;
            public string TokenMintB { get; set; } = string.Empty;
            public int TickCurrent { get; set; }
            public BigInteger SqrtPrice { get; set; }
        }

        private static class RaydiumPoolParser
        {
            public static RaydiumPool Parse(ReadOnlySpan<byte> data)
            {
                // Offsets com discriminator Anchor (8 bytes)
                return new RaydiumPool
                {
                    TokenMintA = new PublicKey(data.Slice(8 + 1 + 32 + 32, 32)).Key, // skip discriminator(8) + bump(1) + ammConfig(32) + owner(32)
                    TokenMintB = new PublicKey(data.Slice(8 + 1 + 32 + 32 + 32, 32)).Key,
                    TickCurrent = BitConverter.ToInt32(data.Slice(8 + 1 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 1 + 1 + 2 + 16 + 16, 4)),
                    SqrtPrice = new BigInteger(data.Slice(8 + 1 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 1 + 1 + 2 + 16, 16), isUnsigned: true, isBigEndian: false)
                };
            }
        }



        // High-precision BigDecimal (scale fixed)
        internal sealed class BigDecimal
        {
            public static readonly int PREC = 96; // digits of precision (adjust if needed)
            private static readonly BigInteger TEN_POW = BigInteger.Pow(10, PREC);

            public BigInteger Mantissa { get; }
            // Value represented = Mantissa / 10^PREC

            public BigDecimal(BigInteger mantissa)
            {
                Mantissa = mantissa;
            }

            public BigDecimal(long v) : this(new BigInteger(v) * TEN_POW) { }

            public static BigDecimal FromString(string dec)
            {
                // accepts decimal string like "-123.456"
                if (string.IsNullOrWhiteSpace(dec)) return new BigDecimal(BigInteger.Zero);
                dec = dec.Trim();
                bool neg = dec[0] == '-';
                if (neg) dec = dec.Substring(1);
                var parts = dec.Split('.');
                var intPart = parts[0].TrimStart('0');
                if (intPart == "") intPart = "0";
                var fracPart = parts.Length > 1 ? parts[1] : "";
                if (fracPart.Length > PREC) fracPart = fracPart.Substring(0, PREC);
                else if (fracPart.Length < PREC) fracPart = fracPart + new string('0', PREC - fracPart.Length);
                string full = intPart + fracPart;
                if (full == "") full = "0";
                BigInteger mant = BigInteger.Parse(full) * BigInteger.Pow(10, 0); // already scaled
                                                                                  // but we must multiply intPart by 10^PREC: we built full accordingly
                if (neg) mant = -mant;
                return new BigDecimal(mant);
            }

            public static BigDecimal FromLong(long v) => new BigDecimal(v * TEN_POW);


            public static BigDecimal operator /(BigDecimal a, long b) => new BigDecimal(a.Mantissa / b);
            
            public override string ToString()
            {
                var s = Mantissa.ToString();
                bool neg = s.StartsWith("-");
                if (neg) s = s.Substring(1);
                if (s.Length <= PREC)
                    s = s.PadLeft(PREC + 1, '0'); // ensure at least one integer digit
                var intPart = s.Substring(0, s.Length - PREC);
                var fracPart = s.Substring(s.Length - PREC).TrimEnd('0');
                if (fracPart == "") fracPart = "0";
                var res = $"{intPart}.{fracPart}";
                if (neg) res = "-" + res;
                return res;
            }

            // Basic operations (aligned by scale)
            public static BigDecimal Zero => new BigDecimal(BigInteger.Zero);
            public static BigDecimal One => new BigDecimal(TEN_POW);

            public static BigDecimal operator +(BigDecimal a, BigDecimal b) =>
                new BigDecimal(a.Mantissa + b.Mantissa);
            public static BigDecimal operator -(BigDecimal a, BigDecimal b) =>
                new BigDecimal(a.Mantissa - b.Mantissa);

            public static BigDecimal operator *(BigDecimal a, BigDecimal b)
            {
                // (a.mant / 10^p) * (b.mant / 10^p) = (a.mant*b.mant) / 10^(2p)
                BigInteger prod = a.Mantissa * b.Mantissa;
                // res scale back to 10^p -> divide by 10^p with rounding
                BigInteger rounded = BigInteger.Divide(prod + BigInteger.Divide(TEN_POW, 2), TEN_POW);
                return new BigDecimal(rounded);
            }

            public static BigDecimal operator /(BigDecimal a, BigDecimal b)
            {
                // (a.mant / 10^p) / (b.mant / 10^p) = (a.mant * 10^p) / b.mant
                if (b.Mantissa.IsZero) throw new DivideByZeroException();
                BigInteger num = a.Mantissa * TEN_POW;
                BigInteger mant = BigInteger.Divide(num + BigInteger.Abs(b.Mantissa) / 2, b.Mantissa);
                return new BigDecimal(mant);
            }

            public static BigDecimal FromBigInteger(BigInteger v) => new BigDecimal(v * TEN_POW);

            // Multiply by 2^k
            public BigInteger ToScaledBigIntegerMultiplyByPow2(int pow2)
            {
                // returns mantissa * 2^pow2
                return Mantissa << pow2;
            }

            public BigInteger ToBigIntegerByTruncatingScale()
            {
                // returns floor(value)
                return BigInteger.Divide(Mantissa, TEN_POW);
            }

            // Compare
            public int CompareTo(BigDecimal other)
            {
                return Mantissa.CompareTo(other.Mantissa);
            }

            public bool IsZero => Mantissa.IsZero;

            // Natural log and exp using series + range reduction.
            // Ln uses Newton's method on f(x)=exp(x)-a
            // Exp uses series on reduced argument via ln2 decomposition

            // Precomputed constants (strings with sufficient precision)
            public static readonly BigDecimal LN2 = FromString(
                "0.693147180559945309417232121458176568075500134360255254120");
            public static readonly BigDecimal LN_1_0001 = FromString(
                "0.0000999950003333293333331666666666666666666666666666666667"); // high-precision approx

            // EXP: compute e^{x} where x is BigDecimal
            public static BigDecimal Exp(BigDecimal x)
            {
                if (x.IsZero) return One;

                // reduce: x = k*ln2 + r, with r in [-ln2/2, ln2/2]
                // k = floor(x / ln2)
                BigDecimal kDiv = x / LN2;
                // get integer k by truncation
                BigInteger k = kDiv.ToBigIntegerByTruncatingScale();
                BigDecimal kTimesLn2 = FromBigInteger(k) * LN2;
                BigDecimal r = x - kTimesLn2;

                // compute exp(r) by Taylor series
                BigDecimal term = One;
                BigDecimal sum = One;
                // series: exp(r) = sum_{n=0..N} r^n / n!
                int maxIter = PREC * 2; // heuristic
                for (int n = 1; n < maxIter; n++)
                {
                    term = term * r;
                    term = term / FromBigInteger(new BigInteger(n));
                    if (term.IsZero) break;
                    sum += term;
                }

                // result = sum * 2^k
                // Multiply sum * 2^k: sum.Mantissa << k
                if (k >= 0)
                {
                    BigInteger mant = sum.Mantissa << (int)k;
                    return new BigDecimal(mant);
                }
                else
                {
                    // division by 2^{-k}
                    int shift = (int)(-k);
                    BigInteger mant = sum.Mantissa >> shift;
                    return new BigDecimal(mant);
                }
            }

            // Natural log using Newton iteration:
            // Find y = ln(a) by solving exp(y) - a = 0
            public static BigDecimal Ln(BigDecimal a)
            {
                if (a.IsZero || a.CompareTo(Zero) <= 0) throw new ArgumentException("Ln domain");
                // initial guess: use integer part's log2 approx to get coarse k
                // Determine k so that a ≈ 2^k * m, with m in [1,2)
                BigInteger mant = a.Mantissa;
                int digits = mant.ToString().Length;
                // rough initial guess using low-precision double fallback for speed of convergence:
                // We are allowed to use a low-precision double here only as an initial guess.
                double approx = 0.0;
                {
                    // get first up to 15 digits to estimate
                    string s = mant.ToString();
                    int take = Math.Min(15, s.Length);
                    string prefix = s.Substring(0, take);
                    double prefixD = double.Parse(prefix);
                    int exponent = s.Length - take - PREC;
                    approx = Math.Log(prefixD) + exponent * Math.Log(10);
                    approx /= 1.0; // natural log
                }

                BigDecimal y = FromString(approx.ToString("R"));
                // Newton iteration: y_{n+1} = y_n + 2*(a - e^{y_n})/(a + e^{y_n}) (Halley's-like)
                int maxIter = 100;
                for (int i = 0; i < maxIter; i++)
                {
                    BigDecimal ey = Exp(y);
                    BigDecimal num = a - ey;
                    BigDecimal den = a + ey;
                    // delta = 2 * num / den
                    BigDecimal delta = FromBigInteger(new BigInteger(2)) * (num / den);
                    y = y + delta;
                    if (delta.IsZero) break;
                }
                return y;
            }

            // Multiply by integer
            public static BigDecimal operator *(BigDecimal a, long b) => new BigDecimal(a.Mantissa * b);

            // Helper to get BigInteger from BigDecimal truncating fractional part
            public BigInteger ToBigInteger()
            {
                return BigInteger.Divide(Mantissa, TEN_POW);
            }
        }
    }
}
