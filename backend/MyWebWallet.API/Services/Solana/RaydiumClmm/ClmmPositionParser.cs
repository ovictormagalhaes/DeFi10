using MyWebWallet.API.Services.Solana.DTO;
using System;

namespace MyWebWallet.API.Services.Solana.RaydiumClmm;

public static class ClmmPositionParser
{
    public static ClmmPositionDTO Parse(byte[] data)
        => OffsetUtils.Parse<ClmmPositionDTO>(data);
}
