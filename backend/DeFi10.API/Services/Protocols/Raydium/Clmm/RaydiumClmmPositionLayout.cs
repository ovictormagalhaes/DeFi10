using Solnet.Wallet;
using System;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm
{
    public class RaydiumClmmPositionLayout
    {

        public byte[] Discriminator { get; set; } = new byte[8];

        public string NftMint { get; set; } = string.Empty;
        public string PoolId { get; set; } = string.Empty;

        public int TickLower { get; set; }
        public int TickUpper { get; set; }

        public BigInteger Liquidity { get; set; }
        public BigInteger FeeGrowthInsideA { get; set; }
        public BigInteger FeeGrowthInsideB { get; set; }

        public ulong FeesOwedTokenA { get; set; }
        public ulong FeesOwedTokenB { get; set; }

        public byte Bump { get; set; }

        public static RaydiumClmmPositionLayout Parse(ReadOnlySpan<byte> data)
        {
            if (data.Length < 160)
                throw new Exception($"Invalid Raydium CLMM Position account size = {data.Length}");

            var dto = new RaydiumClmmPositionLayout();
            int o = 0;

            dto.Discriminator = data.Slice(o, 8).ToArray();
            o += 8;

            dto.NftMint = new PublicKey(data.Slice(o, 32).ToArray()).Key;
            o += 32;

            dto.PoolId = new PublicKey(data.Slice(o, 32).ToArray()).Key;
            o += 32;

            dto.TickLower = BitConverter.ToInt32(data.Slice(o, 4));
            o += 4;

            dto.TickUpper = BitConverter.ToInt32(data.Slice(o, 4));
            o += 4;

            dto.Liquidity = ReadU128(data.Slice(o, 16));
            o += 16;

            dto.FeeGrowthInsideA = ReadU128(data.Slice(o, 16));
            o += 16;

            dto.FeeGrowthInsideB = ReadU128(data.Slice(o, 16));
            o += 16;

            dto.FeesOwedTokenA = ReadU64(data.Slice(o, 8));
            o += 8;

            dto.FeesOwedTokenB = ReadU64(data.Slice(o, 8));
            o += 8;

            dto.Bump = data[o];
            o += 1;

            return dto;
        }

        private static ulong ReadU64(ReadOnlySpan<byte> raw)
        {
            if (!BitConverter.IsLittleEndian)
            {
                Span<byte> tmp = stackalloc byte[8];
                raw.CopyTo(tmp);
                tmp.Reverse();
                return BitConverter.ToUInt64(tmp);
            }
            return BitConverter.ToUInt64(raw);
        }

        private static BigInteger ReadU128(ReadOnlySpan<byte> raw)
        {
            byte[] buf = raw.ToArray();
            if (!BitConverter.IsLittleEndian) Array.Reverse(buf);
            return new BigInteger(buf.Concat(new byte[] { 0 }).ToArray());
        }
    }

    public static class RaydiumClmmPositionLayoutParser
    {
        public static RaydiumClmmPositionLayout Parse(byte[] data)
            => RaydiumClmmPositionLayout.Parse(data.AsSpan());
    }
}
