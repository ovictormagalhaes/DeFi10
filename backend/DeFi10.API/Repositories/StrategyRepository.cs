using Microsoft.Extensions.Options;
using MongoDB.Driver;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure.MongoDB;
using DeFi10.API.Models;
using DeFi10.API.Repositories.Interfaces;

namespace DeFi10.API.Repositories;

public sealed class StrategyRepository : IStrategyRepository
{
    private readonly IMongoCollection<WalletGroupStrategies> _collection;
    private readonly ILogger<StrategyRepository> _logger;

    public StrategyRepository(
        IMongoDBContext context,
        IOptions<MongoDBOptions> options,
        ILogger<StrategyRepository> logger)
    {
        _logger = logger;
        var collectionName = options.Value.Collections.Strategies;
        _collection = context.GetCollection<WalletGroupStrategies>(collectionName);

        // Ensure indexes exist
        CreateIndexesAsync().GetAwaiter().GetResult();
    }

    private async Task CreateIndexesAsync()
    {
        try
        {
            // Index on updatedAt for sorting
            var updatedAtIndexModel = new CreateIndexModel<WalletGroupStrategies>(
                Builders<WalletGroupStrategies>.IndexKeys.Descending(x => x.UpdatedAt),
                new CreateIndexOptions { Name = "idx_updated_at" }
            );

            await _collection.Indexes.CreateOneAsync(updatedAtIndexModel);
            _logger.LogInformation("Strategy repository indexes created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating indexes for Strategy repository");
        }
    }

    public async Task<WalletGroupStrategies?> GetByWalletGroupIdAsync(Guid walletGroupId, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<WalletGroupStrategies>.Filter.Eq(x => x.WalletGroupId, walletGroupId);
            return await _collection.Find(filter).FirstOrDefaultAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Strategies by WalletGroupId={WalletGroupId}", walletGroupId);
            throw;
        }
    }

    public async Task<WalletGroupStrategies> UpsertAsync(WalletGroupStrategies walletGroupStrategies, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<WalletGroupStrategies>.Filter.Eq(x => x.WalletGroupId, walletGroupStrategies.WalletGroupId);
            var options = new ReplaceOptions { IsUpsert = true };

            await _collection.ReplaceOneAsync(filter, walletGroupStrategies, options, ct);
            
            _logger.LogDebug("Upserted strategies for WalletGroupId={WalletGroupId}, Count={Count}", 
                walletGroupStrategies.WalletGroupId, walletGroupStrategies.Count);
            
            return walletGroupStrategies;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upsert strategies for WalletGroupId={WalletGroupId}", walletGroupStrategies.WalletGroupId);
            throw;
        }
    }

    public async Task<bool> DeleteByWalletGroupIdAsync(Guid walletGroupId, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<WalletGroupStrategies>.Filter.Eq(x => x.WalletGroupId, walletGroupId);
            var result = await _collection.DeleteOneAsync(filter, ct);
            
            _logger.LogDebug("Deleted strategies document for WalletGroupId={WalletGroupId}", walletGroupId);
            return result.DeletedCount > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete strategies for WalletGroupId={WalletGroupId}", walletGroupId);
            throw;
        }
    }
}
