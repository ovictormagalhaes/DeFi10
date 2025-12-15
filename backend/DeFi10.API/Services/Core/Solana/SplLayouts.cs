using Solnet.Wallet;
using System;

namespace DeFi10.API.Services.Core.Solana
{
    internal static class SplTokenAccountLayout
    {
        public static SplTokenAccountData Parse(ReadOnlySpan<byte> data)
        {
            if (data.Length < 72) throw new ArgumentException($"Invalid token account data length {data.Length}");
            var mint = new PublicKey(data.Slice(0,32)).Key;

            ulong amount = BitConverter.ToUInt64(data.Slice(64,8));
            return new SplTokenAccountData { Mint = mint, Amount = amount };
        }
    }
    internal class SplTokenAccountData
    {
        public string Mint { get; set; } = string.Empty;
        public ulong Amount { get; set; }
    }

    internal static class SplMintAccountLayout
    {
        public static SplMintAccountData Parse(ReadOnlySpan<byte> data)
        {

            if (data.Length < 46) throw new ArgumentException($"Invalid mint account data length {data.Length}");
            byte decimals = data[44];
            return new SplMintAccountData { Decimals = decimals };
        }
    }
    internal class SplMintAccountData
    {
        public byte Decimals { get; set; }
    }
}
