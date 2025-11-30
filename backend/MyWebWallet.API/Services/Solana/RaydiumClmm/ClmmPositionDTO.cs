using MyWebWallet.API.Services.Solana.RaydiumClmm;
using Solnet.Wallet;
using System;
using System.Numerics;

namespace MyWebWallet.API.Services.Solana.DTO
{
    public class PositionRewardInfo
    {
        public BigInteger GrowthInsideLastX64 { get; set; }
        public ulong RewardAmountOwed { get; set; }
    }

    public class ClmmPositionDTO
    {
        [Offset(0)] public byte[] Discriminator { get; set; } = new byte[8];
        [Offset(8)] public byte Bump { get; set; }
        [Offset(9)] public string NftMint { get; set; } = string.Empty;
        [Offset(41)] public string PoolId { get; set; } = string.Empty;
        [Offset(73)] public int TickLower { get; set; }
        [Offset(77)] public int TickUpper { get; set; }
        [Offset(81)] public BigInteger Liquidity { get; set; }
        [Offset(97)] public BigInteger FeeGrowthInsideA { get; set; }
        [Offset(113)] public BigInteger FeeGrowthInsideB { get; set; }
        [Offset(129)] public ulong FeesOwedTokenA { get; set; }
        [Offset(137)] public ulong FeesOwedTokenB { get; set; }
        [Offset(145)] public PositionRewardInfo[] RewardInfos { get; set; } = new PositionRewardInfo[3];
        [Offset(217)] public ulong RecentEpoch { get; set; }

        public static ClmmPositionDTO Parse(ReadOnlySpan<byte> data)
        {
            // Layout da struct PersonalPositionState do Raydium CLMM v2:
            // discriminator(8) + bump(1) + nft_mint(32) + pool_id(32) + 
            // tick_lower(4) + tick_upper(4) + liquidity(16) + 
            // fee_growth_inside_0(16) + fee_growth_inside_1(16) +
            // token_fees_owed_0(8) + token_fees_owed_1(8) +
            // reward_infos[3](growth_inside_last_x64(16) + reward_amount_owed(8)) * 3 = 72 bytes
            // recent_epoch(8) + padding(56) = Total: 281 bytes
            if (data.Length < 217) throw new Exception($"Invalid CLMM Position account size={data.Length}, expected at least 217");
            
            var dto = new ClmmPositionDTO();
            int o = 0;
            
            dto.Discriminator = data.Slice(o, 8).ToArray(); o += 8;
            dto.Bump = data[o]; o += 1;
            dto.NftMint = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            dto.PoolId = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            dto.TickLower = BitConverter.ToInt32(data.Slice(o)); o += 4;
            dto.TickUpper = BitConverter.ToInt32(data.Slice(o)); o += 4;
            dto.Liquidity = ReadU128(data.Slice(o, 16)); o += 16;
            dto.FeeGrowthInsideA = ReadU128(data.Slice(o, 16)); o += 16;
            dto.FeeGrowthInsideB = ReadU128(data.Slice(o, 16)); o += 16;
            
            dto.FeesOwedTokenA = BitConverter.ToUInt64(data.Slice(o)); o += 8;
            dto.FeesOwedTokenB = BitConverter.ToUInt64(data.Slice(o)); o += 8;
            
            // Parse reward_infos array (3 elements)
            dto.RewardInfos = new PositionRewardInfo[3];
            for (int i = 0; i < 3; i++)
            {
                dto.RewardInfos[i] = new PositionRewardInfo
                {
                    GrowthInsideLastX64 = ReadU128(data.Slice(o, 16)),
                    RewardAmountOwed = BitConverter.ToUInt64(data.Slice(o + 16))
                };
                o += 24; // 16 bytes (u128) + 8 bytes (u64)
            }
            
            if (data.Length >= o + 8)
            {
                dto.RecentEpoch = BitConverter.ToUInt64(data.Slice(o));
            }
            
            return dto;
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
