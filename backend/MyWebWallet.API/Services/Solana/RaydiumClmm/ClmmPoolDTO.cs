using Solnet.Wallet;
using System;
using System.Numerics;

namespace MyWebWallet.API.Services.Solana.DTO
{
    public class ClmmPoolDTO
    {
        public string PoolAddress { get; set; } = string.Empty;
        public string TokenMintA { get; set; } = string.Empty;
        public string TokenMintB { get; set; } = string.Empty;
        public string VaultA { get; set; } = string.Empty;
        public string VaultB { get; set; } = string.Empty;
        public ushort TickSpacing { get; set; }
        public BigInteger SqrtPriceX64 { get; set; }
        public int TickCurrent { get; set; }
        public BigInteger Liquidity { get; set; }
        public BigInteger FeeGrowthGlobal0X64 { get; set; }
        public BigInteger FeeGrowthGlobal1X64 { get; set; }

        public static ClmmPoolDTO Parse(ReadOnlySpan<byte> data, string poolAddress)
        {
            if (data.Length < 300) throw new Exception($"Invalid pool size {data.Length}");
            
            // Layout da struct PoolState do Raydium:
            // discriminator(8) + bump(1) + ammConfig(32) + owner(32) + tokenMint0(32) + tokenMint1(32) + tokenVault0(32) + tokenVault1(32)
            // + observationKey(32) + mintDecimals0(1) + mintDecimals1(1) + tickSpacing(2) + liquidity(16) + sqrtPriceX64(16) + tickCurrent(4)
            
            int o = 8; // skip Anchor discriminator
            o += 1; // bump: u8
            o += 32; // ammConfig: publicKey
            o += 32; // owner: publicKey
            // Agora estamos no offset 73
            
            var p = new ClmmPoolDTO();
            p.TokenMintA = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32; // tokenMint0 @ 73
            p.TokenMintB = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32; // tokenMint1 @ 105
            p.VaultA = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32; // tokenVault0 @ 137
            p.VaultB = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32; // tokenVault1 @ 169
            
            o += 32; // observationKey: publicKey
            o += 1; // mintDecimals0: u8
            o += 1; // mintDecimals1: u8
            
            p.PoolAddress = poolAddress;
            p.TickSpacing = BitConverter.ToUInt16(data.Slice(o, 2)); o += 2; // tickSpacing: u16
            
            p.Liquidity = ReadU128(data.Slice(o, 16)); o += 16; // liquidity: u128
            p.SqrtPriceX64 = ReadU128(data.Slice(o, 16)); o += 16; // sqrtPriceX64: u128
            p.TickCurrent = BitConverter.ToInt32(data.Slice(o, 4)); o += 4; // tickCurrent: i32
            
            o += 2; // padding3: u16
            o += 2; // padding4: u16
            
            p.FeeGrowthGlobal0X64 = ReadU128(data.Slice(o, 16)); o += 16; // fee_growth_global_0_x64: u128
            p.FeeGrowthGlobal1X64 = ReadU128(data.Slice(o, 16)); o += 16; // fee_growth_global_1_x64: u128
            
            return p;
        }

        private static BigInteger ReadU128(ReadOnlySpan<byte> raw)
        {
            var buf = raw.ToArray();
            if (!BitConverter.IsLittleEndian) Array.Reverse(buf);
            var tmp = new byte[17];
            Array.Copy(buf, tmp, 16);
            tmp[16] = 0;
            return new BigInteger(tmp);
        }
    }
}
