using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces;

public interface IPendleService
{
    // Retorna objeto bruto (DTO) das posições vePendle para um address em uma chain
    Task<PendleVePositionsResponse?> GetVePositionsAsync(string account, ChainEnum chain);

    // Novo: Retorna depósitos Pendle (PT balances) detectando tokens a partir do address (sem settings de markets)
    Task<PendleDepositsResponse?> GetDepositsAsync(string account, ChainEnum chain);
}
