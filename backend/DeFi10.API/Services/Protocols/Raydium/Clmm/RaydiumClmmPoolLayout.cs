using Solnet.Wallet;
using System;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm
{
    public class RaydiumClmmPoolLayout
    {
        public string TokenMintA { get; set; } = string.Empty;
        public string TokenMintB { get; set; } = string.Empty;
        public string VaultA { get; set; } = string.Empty;
        public string VaultB { get; set; } = string.Empty;
        public BigInteger SqrtPriceX64 { get; set; }
        public int TickCurrent { get; set; }
        public BigInteger Liquidity { get; set; }

        public static RaydiumClmmPoolLayout TryParse(ReadOnlySpan<byte> data)
        {
            if (data.Length < 200) throw new Exception($"Pool data too small ({data.Length})");

            int o = 8;
            var layout = new RaydiumClmmPoolLayout();

            layout.TokenMintA = new PublicKey(data.Slice(o, 32).ToArray()).Key;
            o += 32;

            layout.TokenMintB = new PublicKey(data.Slice(o, 32).ToArray()).Key;
            o += 32;

            layout.VaultA = new PublicKey(data.Slice(o, 32).ToArray()).Key;
            o += 32;

            layout.VaultB = new PublicKey(data.Slice(o, 32).ToArray()).Key;
            o += 32;

            layout.SqrtPriceX64 = ReadU128(data.Slice(o, 16));
            o += 16;

            layout.TickCurrent = BitConverter.ToInt32(data.Slice(o, 4));
            o += 4;

            layout.Liquidity = ReadU128(data.Slice(o, 16));
            o += 16;

            return layout;
        }

        private static BigInteger ReadU128(ReadOnlySpan<byte> raw)
        {
            byte[] buf = raw.ToArray();
            if (!BitConverter.IsLittleEndian) Array.Reverse(buf);
            return new BigInteger(buf.Concat(new byte[] { 0 }).ToArray());
        }
    }
}
