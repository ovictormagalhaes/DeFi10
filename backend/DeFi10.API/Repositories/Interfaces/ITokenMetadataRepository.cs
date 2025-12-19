using DeFi10.API.Models.Persistence;

namespace DeFi10.API.Repositories.Interfaces;

public interface ITokenMetadataRepository
{
    Task<IReadOnlyList<TokenMetadataDocument>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<TokenMetadataDocument?> GetByChainAndAddressAsync(int chainId, string address, CancellationToken cancellationToken = default);    
    Task<IReadOnlyList<TokenMetadataDocument>> GetBySymbolAndNameAsync(string symbol, string name, CancellationToken cancellationToken = default);
    Task UpsertAsync(TokenMetadataDocument token, CancellationToken cancellationToken = default);
    Task BulkUpsertAsync(IEnumerable<TokenMetadataDocument> tokens, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int chainId, string address, CancellationToken cancellationToken = default);
    Task<long> GetCountAsync(CancellationToken cancellationToken = default);
}
