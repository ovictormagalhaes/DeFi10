using Microsoft.Extensions.Options;
using MongoDB.Driver;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure.MongoDB;
using DeFi10.API.Models;
using DeFi10.API.Repositories.Interfaces;

namespace DeFi10.API.Repositories;

public sealed class StrategyRepository : IStrategyRepository
{
    private readonly IMongoCollection<Strategy> _collection;
    private readonly ILogger<StrategyRepository> _logger;

    public StrategyRepository(
        IMongoDBContext context,
        IOptions<MongoDBOptions> options,
        ILogger<StrategyRepository> logger)
    {
        _logger = logger;
        var collectionName = options.Value.Collections.Strategies;
        _collection = context.GetCollection<Strategy>(collectionName);

        // Ensure indexes exist
        CreateIndexesAsync().GetAwaiter().GetResult();
    }

    private async Task CreateIndexesAsync()
    {
        try
        {
            // Unique index on walletGroupId
            var walletGroupIdIndexModel = new CreateIndexModel<Strategy>(
                Builders<Strategy>.IndexKeys.Ascending(x => x.WalletGroupId),
                new CreateIndexOptions { Name = "idx_wallet_group_id_unique", Unique = true }
            );

            // Index on createdAt for sorting
            var createdAtIndexModel = new CreateIndexModel<Strategy>(
                Builders<Strategy>.IndexKeys.Descending(x => x.CreatedAt),
                new CreateIndexOptions { Name = "idx_created_at" }
            );

            // Index on isDeleted for filtering soft-deleted records
            var isDeletedIndexModel = new CreateIndexModel<Strategy>(
                Builders<Strategy>.IndexKeys.Ascending(x => x.IsDeleted),
                new CreateIndexOptions { Name = "idx_is_deleted" }
            );

            await _collection.Indexes.CreateManyAsync(new[]
            {
                walletGroupIdIndexModel,
                createdAtIndexModel,
                isDeletedIndexModel
            });

            _logger.LogDebug("MongoDB indexes created successfully for Strategies collection");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create MongoDB indexes (they may already exist)");
        }
    }

    public async Task<Strategy?> GetByWalletGroupIdAsync(Guid walletGroupId, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<Strategy>.Filter.And(
                Builders<Strategy>.Filter.Eq(x => x.WalletGroupId, walletGroupId),
                Builders<Strategy>.Filter.Eq(x => x.IsDeleted, false)
            );

            return await _collection.Find(filter).FirstOrDefaultAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Strategy by WalletGroupId={WalletGroupId}", walletGroupId);
            throw;
        }
    }

    public async Task<List<Strategy>> GetByWalletGroupIdsAsync(IEnumerable<Guid> walletGroupIds, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<Strategy>.Filter.And(
                Builders<Strategy>.Filter.In(x => x.WalletGroupId, walletGroupIds),
                Builders<Strategy>.Filter.Eq(x => x.IsDeleted, false)
            );

            return await _collection.Find(filter).ToListAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Strategies by WalletGroupIds");
            throw;
        }
    }

    public async Task<Strategy> CreateAsync(Strategy strategy, CancellationToken ct = default)
    {
        try
        {
            await _collection.InsertOneAsync(strategy, cancellationToken: ct);
            _logger.LogDebug("Created Strategy Id={Id} for WalletGroupId={WalletGroupId}", strategy.Id, strategy.WalletGroupId);
            return strategy;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Strategy for WalletGroupId={WalletGroupId}", strategy.WalletGroupId);
            throw;
        }
    }

    public async Task<Strategy> UpdateAsync(Strategy strategy, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<Strategy>.Filter.And(
                Builders<Strategy>.Filter.Eq(x => x.Id, strategy.Id),
                Builders<Strategy>.Filter.Eq(x => x.IsDeleted, false)
            );

            var result = await _collection.ReplaceOneAsync(filter, strategy, cancellationToken: ct);

            if (result.MatchedCount == 0)
            {
                throw new InvalidOperationException($"Strategy with Id={strategy.Id} not found or already deleted");
            }

            _logger.LogDebug("Updated Strategy Id={Id} for WalletGroupId={WalletGroupId}", strategy.Id, strategy.WalletGroupId);
            return strategy;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update Strategy Id={Id}", strategy.Id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        try
        {
            // Soft delete
            var filter = Builders<Strategy>.Filter.And(
                Builders<Strategy>.Filter.Eq(x => x.Id, id),
                Builders<Strategy>.Filter.Eq(x => x.IsDeleted, false)
            );

            var update = Builders<Strategy>.Update
                .Set(x => x.IsDeleted, true)
                .Set(x => x.UpdatedAt, DateTime.UtcNow);

            var result = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);

            if (result.MatchedCount > 0)
            {
                _logger.LogDebug("Deleted (soft) Strategy Id={Id}", id);
                return true;
            }

            _logger.LogWarning("Strategy Id={Id} not found for deletion", id);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete Strategy Id={Id}", id);
            throw;
        }
    }

    public async Task<bool> ExistsAsync(Guid walletGroupId, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<Strategy>.Filter.And(
                Builders<Strategy>.Filter.Eq(x => x.WalletGroupId, walletGroupId),
                Builders<Strategy>.Filter.Eq(x => x.IsDeleted, false)
            );

            var count = await _collection.CountDocumentsAsync(filter, cancellationToken: ct);
            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check existence of Strategy for WalletGroupId={WalletGroupId}", walletGroupId);
            throw;
        }
    }
}
