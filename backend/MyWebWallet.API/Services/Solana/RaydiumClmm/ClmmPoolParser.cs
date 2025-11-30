using MyWebWallet.API.Services.Solana.DTO;
using System;

namespace MyWebWallet.API.Services.Solana.RaydiumClmm;

public static class ClmmPoolParser
{
    public static ClmmPoolDTO Parse(byte[] data)
        => OffsetUtils.Parse<ClmmPoolDTO>(data);
}
