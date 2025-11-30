using System;
using System.Buffers.Binary;
using System.Linq;
using System.Numerics;
using Solnet.Wallet;

namespace MyWebWallet.API.Services.Solana.RaydiumClmm
{
    public class TickState
    {
        public int Tick { get; set; }
        public BigInteger LiquidityNet { get; set; }
        public BigInteger LiquidityGross { get; set; }
        public BigInteger FeeGrowthOutside0X64 { get; set; }
        public BigInteger FeeGrowthOutside1X64 { get; set; }
        public BigInteger[] RewardGrowthsOutsideX64 { get; set; } = new BigInteger[3];

        public static TickState Parse(ReadOnlySpan<byte> data)
        {
            // TickState structure (120 bytes):
            // tick(4) + liquidity_net(16) + liquidity_gross(16) + fee_growth_outside_0(16) + fee_growth_outside_1(16) + reward_growths_outside(3*16) + padding(52)
            int o = 0;
            var t = new TickState();
            t.Tick = BinaryPrimitives.ReadInt32LittleEndian(data.Slice(o, 4)); o += 4;
            t.LiquidityNet = ReadI128(data.Slice(o, 16)); o += 16;
            t.LiquidityGross = ReadU128(data.Slice(o, 16)); o += 16;
            t.FeeGrowthOutside0X64 = ReadU128(data.Slice(o, 16)); o += 16;
            t.FeeGrowthOutside1X64 = ReadU128(data.Slice(o, 16)); o += 16;
            for (int i = 0; i < 3; i++)
            {
                t.RewardGrowthsOutsideX64[i] = ReadU128(data.Slice(o, 16));
                o += 16;
            }
            return t;
        }

        private static BigInteger ReadU128(ReadOnlySpan<byte> data)
        {
            return new BigInteger(data, isUnsigned: true, isBigEndian: false);
        }

        private static BigInteger ReadI128(ReadOnlySpan<byte> data)
        {
            return new BigInteger(data, isUnsigned: false, isBigEndian: false);
        }

        public const int TICK_STATE_SIZE = 120; // bytes
    }

    public class TickArrayState
    {
        public string PoolId { get; set; } = string.Empty;
        public int StartTickIndex { get; set; }
        public TickState[] Ticks { get; set; } = new TickState[60];
        public byte InitializedTickCount { get; set; }

        public static TickArrayState Parse(ReadOnlySpan<byte> data)
        {
            // TickArrayState structure:
            // discriminator(8) + pool_id(32) + start_tick_index(4) + ticks(60*120) + initialized_tick_count(1) + recent_epoch(8) + padding(115)
            int o = 8; // skip discriminator
            var ta = new TickArrayState();
            var pubkeyBytes = data.Slice(o, 32).ToArray();
            ta.PoolId = new PublicKey(pubkeyBytes).Key; o += 32;
            ta.StartTickIndex = BinaryPrimitives.ReadInt32LittleEndian(data.Slice(o, 4)); o += 4;
            
            for (int i = 0; i < 60; i++)
            {
                ta.Ticks[i] = TickState.Parse(data.Slice(o, TickState.TICK_STATE_SIZE));
                o += TickState.TICK_STATE_SIZE;
            }
            
            ta.InitializedTickCount = data[o]; o += 1;
            
            return ta;
        }

        public TickState? GetTick(int tickIndex)
        {
            var tick = Ticks.FirstOrDefault(t => t.Tick == tickIndex && t.LiquidityGross > 0);
            return tick;
        }

        public const int TICK_ARRAY_SIZE = 60;
    }
}
