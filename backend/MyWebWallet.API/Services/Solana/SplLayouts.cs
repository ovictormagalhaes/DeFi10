using Solnet.Wallet;
using System;

namespace MyWebWallet.API.Services.Solana
{
    internal static class SplTokenAccountLayout
    {
        public static SplTokenAccountData Parse(ReadOnlySpan<byte> data)
        {
            // SPL Token account expected length 165 bytes (standard) or longer for Token-2022 with extensions
            // Minimum: 72 bytes for basic fields (mint=32, owner=32, amount=8)
            if (data.Length < 72) throw new ArgumentException($"Invalid token account data length {data.Length}");
            var mint = new PublicKey(data.Slice(0,32)).Key;
            // owner at 32..63 not needed now
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
            // SPL mint account expected length 82 bytes
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
