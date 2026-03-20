using DeFi10.API.Models;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Aave;

public interface IAaveeService
{
    Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain);
    Task<AaveGetUserBorrowsResponse> GetUserBorrows(string address, string chain);
    
    /// <summary>
    /// Obtém posições do usuário com cache inteligente
    /// Cache é válido se soma de supplies e borrows em USD estiver dentro de 0.01% de tolerância
    /// </summary>
    Task<(AaveGetUserSuppliesResponse supplies, AaveGetUserBorrowsResponse borrows)> GetUserPositionsWithCacheAsync(
        string address, 
        string chain);

    /// <summary>
    /// Obtém histórico de transações do usuário (deposit, borrow, withdraw, repay)
    /// </summary>
    Task<AaveTransactionHistoryResponse> GetUserTransactionHistoryAsync(string address, string chain);

    Task<HashSet<string>> GetWrapperTokenAddressesAsync(ChainEnum chain);
}