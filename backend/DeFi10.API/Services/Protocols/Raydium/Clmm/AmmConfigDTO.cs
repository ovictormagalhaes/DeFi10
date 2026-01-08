using Solnet.Wallet;
using System;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm.DTO
{
    public class AmmConfigDTO
    {
        public byte Bump { get; set; }
        public ushort Index { get; set; }
        public string Owner { get; set; } = string.Empty;
        public uint ProtocolFeeRate { get; set; }
        public uint TradeFeeRate { get; set; }  // denominated in hundredths of a bip (10^-6), so 400 = 0.04%
        public ushort TickSpacing { get; set; }
        public uint FundFeeRate { get; set; }

        public static AmmConfigDTO Parse(ReadOnlySpan<byte> data)
        {
            if (data.Length < 100) throw new Exception($"Invalid AmmConfig size {data.Length}");

            var config = new AmmConfigDTO();
            int o = 8; // Skip discriminator

            config.Bump = data[o]; o += 1;
            config.Index = BitConverter.ToUInt16(data.Slice(o, 2)); o += 2;
            config.Owner = new PublicKey(data.Slice(o, 32).ToArray()).Key; o += 32;
            config.ProtocolFeeRate = BitConverter.ToUInt32(data.Slice(o, 4)); o += 4;
            config.TradeFeeRate = BitConverter.ToUInt32(data.Slice(o, 4)); o += 4;
            config.TickSpacing = BitConverter.ToUInt16(data.Slice(o, 2)); o += 2;
            config.FundFeeRate = BitConverter.ToUInt32(data.Slice(o, 4)); o += 4;

            return config;
        }
    }
}
