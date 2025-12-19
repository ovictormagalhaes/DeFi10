using Microsoft.Extensions.Options;
using MongoDB.Driver;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure.MongoDB;
using DeFi10.API.Models;
using DeFi10.API.Repositories.Interfaces;

namespace DeFi10.API.Repositories;

public sealed class WalletGroupRepository : IWalletGroupRepository
{
    private readonly IMongoCollection<WalletGroup> _collection;
    private readonly ILogger<WalletGroupRepository> _logger;

    public WalletGroupRepository(
        IMongoDBContext context,
        IOptions<MongoDBOptions> options,
        ILogger<WalletGroupRepository> logger)
    {
        _logger = logger;
        var collectionName = options.Value.Collections.WalletGroups;
        _collection = context.GetCollection<WalletGroup>(collectionName);

        // Ensure indexes exist
        CreateIndexesAsync().GetAwaiter().GetResult();
    }

    private async Task CreateIndexesAsync()
    {
        try
        {
            // Index on wallets array for fast lookups
            var walletsIndexModel = new CreateIndexModel<WalletGroup>(
                Builders<WalletGroup>.IndexKeys.Ascending(x => x.Wallets),
                new CreateIndexOptions { Name = "idx_wallets" }
            );

            // Index on createdAt for sorting
            var createdAtIndexModel = new CreateIndexModel<WalletGroup>(
                Builders<WalletGroup>.IndexKeys.Descending(x => x.CreatedAt),
                new CreateIndexOptions { Name = "idx_created_at" }
            );

            // Index on isDeleted for filtering soft-deleted records
            var isDeletedIndexModel = new CreateIndexModel<WalletGroup>(
                Builders<WalletGroup>.IndexKeys.Ascending(x => x.IsDeleted),
                new CreateIndexOptions { Name = "idx_is_deleted" }
            );

            await _collection.Indexes.CreateManyAsync(new[]
            {
                walletsIndexModel,
                createdAtIndexModel,
                isDeletedIndexModel
            });

            _logger.LogDebug("MongoDB indexes created successfully for WalletGroups collection");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create MongoDB indexes (they may already exist)");
        }
    }

    public async Task<WalletGroup?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<WalletGroup>.Filter.And(
                Builders<WalletGroup>.Filter.Eq(x => x.Id, id),
                Builders<WalletGroup>.Filter.Eq(x => x.IsDeleted, false)
            );

            return await _collection.Find(filter).FirstOrDefaultAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get WalletGroup by Id={Id}", id);
            throw;
        }
    }

    public async Task<WalletGroup> CreateAsync(WalletGroup walletGroup, CancellationToken ct = default)
    {
        try
        {
            await _collection.InsertOneAsync(walletGroup, cancellationToken: ct);
            _logger.LogDebug("Created WalletGroup Id={Id}", walletGroup.Id);
            return walletGroup;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create WalletGroup Id={Id}", walletGroup.Id);
            throw;
        }
    }

    public async Task<WalletGroup> UpdateAsync(WalletGroup walletGroup, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<WalletGroup>.Filter.And(
                Builders<WalletGroup>.Filter.Eq(x => x.Id, walletGroup.Id),
                Builders<WalletGroup>.Filter.Eq(x => x.IsDeleted, false)
            );

            var result = await _collection.ReplaceOneAsync(filter, walletGroup, cancellationToken: ct);

            if (result.MatchedCount == 0)
            {
                throw new InvalidOperationException($"WalletGroup with Id={walletGroup.Id} not found or already deleted");
            }

            _logger.LogDebug("Updated WalletGroup Id={Id}", walletGroup.Id);
            return walletGroup;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update WalletGroup Id={Id}", walletGroup.Id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        try
        {
            // Soft delete
            var filter = Builders<WalletGroup>.Filter.And(
                Builders<WalletGroup>.Filter.Eq(x => x.Id, id),
                Builders<WalletGroup>.Filter.Eq(x => x.IsDeleted, false)
            );

            var update = Builders<WalletGroup>.Update
                .Set(x => x.IsDeleted, true)
                .Set(x => x.UpdatedAt, DateTime.UtcNow);

            var result = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);

            if (result.MatchedCount > 0)
            {
                _logger.LogDebug("Deleted (soft) WalletGroup Id={Id}", id);
                return true;
            }

            _logger.LogWarning("WalletGroup Id={Id} not found for deletion", id);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete WalletGroup Id={Id}", id);
            throw;
        }
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
    {
        try
        {
            var filter = Builders<WalletGroup>.Filter.And(
                Builders<WalletGroup>.Filter.Eq(x => x.Id, id),
                Builders<WalletGroup>.Filter.Eq(x => x.IsDeleted, false)
            );

            var count = await _collection.CountDocumentsAsync(filter, cancellationToken: ct);
            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check existence of WalletGroup Id={Id}", id);
            throw;
        }
    }

    public async Task<List<WalletGroup>> FindByWalletAddressAsync(string walletAddress, CancellationToken ct = default)
    {
        try
        {
            var normalizedAddress = walletAddress.ToLowerInvariant();

            var filter = Builders<WalletGroup>.Filter.And(
                Builders<WalletGroup>.Filter.AnyEq(x => x.Wallets, normalizedAddress),
                Builders<WalletGroup>.Filter.Eq(x => x.IsDeleted, false)
            );

            return await _collection.Find(filter).ToListAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to find WalletGroups by wallet address={Address}", walletAddress);
            throw;
        }
    }
}
