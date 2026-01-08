using Microsoft.Extensions.Logging;
using Solnet.Wallet;
using System;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm.DTO
{
    public class ClmmPoolDTO
    {
        public string PoolAddress { get; set; } = string.Empty;
        public string AmmConfig { get; set; } = string.Empty;
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

        public static ClmmPoolDTO Parse(ReadOnlySpan<byte> data, string poolAddress, ILogger? logger = null)
        {
            if (data.Length < 300) throw new Exception($"Invalid pool size {data.Length}");


            int o = 8;
            o += 1; // bump
            
            var p = new ClmmPoolDTO();
            p.AmmConfig = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            o += 32; // owner
            
            p.TokenMintA = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            p.TokenMintB = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            p.VaultA = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            p.VaultB = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            
            o += 32;
            o += 1;
            o += 1;
            
            p.PoolAddress = poolAddress;
            p.TickSpacing = BitConverter.ToUInt16(data.Slice(o, 2)); o += 2;
            
            p.Liquidity = ReadU128(data.Slice(o, 16)); o += 16;
            p.SqrtPriceX64 = ReadU128(data.Slice(o, 16)); o += 16;
            p.TickCurrent = BitConverter.ToInt32(data.Slice(o, 4)); o += 4;
            
            o += 2;
            o += 2;
            
            p.FeeGrowthGlobal0X64 = ReadU128(data.Slice(o, 16)); o += 16;
            p.FeeGrowthGlobal1X64 = ReadU128(data.Slice(o, 16)); o += 16;
            
            // Skip protocol_fees_token_0 (16 bytes) and protocol_fees_token_1 (16 bytes)
            o += 32;
            
            // Skip swap_in_amount_token_0 (16 bytes) and swap_in_amount_token_1 (16 bytes)
            o += 32;
            
            // Skip swap_out_amount_token_0 (16 bytes) and swap_out_amount_token_1 (16 bytes)
            o += 32;
            
            // Skip status (1 byte)
            o += 1;
            
            // Skip padding (7 bytes)
            o += 7;
            
            // Skip reward_infos (3 * 144 bytes = 432 bytes)
            o += 432;
            
            // Skip tick_arrays (11 * 32 bytes = 352 bytes)
            o += 352;
            
            // Skip total_fees_token_0 (8 bytes) and total_fees_claimed_token_0 (8 bytes)
            o += 16;
            
            // Skip total_fees_token_1 (8 bytes) and total_fees_claimed_token_1 (8 bytes)
            o += 16;
            
            // Skip fund_fees_token_0 (8 bytes) and fund_fees_token_1 (8 bytes)
            o += 16;
            
            // Note: trade_fee_rate is NOT in PoolState, it's in the AmmConfig account
            // We need to fetch it separately using p.AmmConfig
            
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