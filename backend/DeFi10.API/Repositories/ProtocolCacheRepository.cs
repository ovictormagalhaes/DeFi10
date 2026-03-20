using DeFi10.API.Models.Cache;
using DeFi10.API.Repositories.Interfaces;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DeFi10.API.Repositories
{
    /// <summary>
    /// Implementação do repository de cache genérico com MongoDB
    /// </summary>
    public class ProtocolCacheRepository : IProtocolCacheRepository
    {
        private const string COLLECTION_NAME = "protocol_cache";
        
        private readonly IMongoCollection<ProtocolCacheDocument> _collection;
        private readonly ILogger<ProtocolCacheRepository> _logger;

        public ProtocolCacheRepository(
            IMongoDatabase database,
            ILogger<ProtocolCacheRepository> logger)
        {
            _collection = database.GetCollection<ProtocolCacheDocument>(COLLECTION_NAME);
            _logger = logger;
            
            // Criar índices ao inicializar
            _ = EnsureIndexesAsync();
        }

        private async Task EnsureIndexesAsync()
        {
            try
            {
                var indexKeys = Builders<ProtocolCacheDocument>.IndexKeys;

                // Índice único composto (chave principal)
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys
                            .Ascending(d => d.Protocol)
                            .Ascending(d => d.ProtocolId)
                            .Ascending(d => d.WalletAddress)
                            .Ascending(d => d.DataType),
                        new CreateIndexOptions { Unique = true, Name = "idx_unique_cache_key" }
                    )
                );

                // Índice para busca por wallet
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys
                            .Ascending(d => d.WalletAddress)
                            .Ascending(d => d.Protocol),
                        new CreateIndexOptions { Name = "idx_wallet_protocol" }
                    )
                );

                // Índice para busca por pool address
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys.Ascending("relatedIds.poolAddress"),
                        new CreateIndexOptions { Name = "idx_pool_address", Sparse = true }
                    )
                );

                // Índice para busca por market ID
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys.Ascending("relatedIds.marketId"),
                        new CreateIndexOptions { Name = "idx_market_id", Sparse = true }
                    )
                );

                // Índice para busca por token pair
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys
                            .Ascending("relatedIds.tokenPair")
                            .Ascending(d => d.Protocol),
                        new CreateIndexOptions { Name = "idx_token_pair", Sparse = true }
                    )
                );

                // TTL index (MongoDB remove automaticamente após expiresAt)
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys.Ascending("cacheMetadata.expiresAt"),
                        new CreateIndexOptions 
                        { 
                            Name = "idx_ttl_expires",
                            ExpireAfter = TimeSpan.Zero 
                        }
                    )
                );

                // Índice para LRU cleanup
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys
                            .Ascending("cacheMetadata.lastAccessedAt")
                            .Ascending("cacheMetadata.accessCount"),
                        new CreateIndexOptions { Name = "idx_lru_cleanup" }
                    )
                );

                // Índice para chain e dataType
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys
                            .Ascending(d => d.Chain)
                            .Ascending(d => d.DataType)
                            .Ascending(d => d.Protocol),
                        new CreateIndexOptions { Name = "idx_chain_datatype" }
                    )
                );

                // Índice para validação
                await _collection.Indexes.CreateOneAsync(
                    new CreateIndexModel<ProtocolCacheDocument>(
                        indexKeys
                            .Ascending("cacheMetadata.isValid")
                            .Ascending(d => d.Protocol),
                        new CreateIndexOptions { Name = "idx_validation_status" }
                    )
                );

                _logger.LogInformation("MongoDB indexes created successfully for protocol_cache collection");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create indexes (may already exist)");
            }
        }

        public async Task<ProtocolCacheDocument?> GetCacheAsync(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType)
        {
            try
            {
                var filter = Builders<ProtocolCacheDocument>.Filter.And(
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.Protocol, protocol),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.ProtocolId, protocolId),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.WalletAddress, walletAddress),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.DataType, dataType)
                );

                return await _collection.Find(filter).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, 
                    "Error getting cache: Protocol={Protocol}, ProtocolId={ProtocolId}, Wallet={Wallet}, DataType={DataType}",
                    protocol, protocolId, walletAddress, dataType);
                return null;
            }
        }

        public async Task SaveCacheAsync(ProtocolCacheDocument cache)
        {
            try
            {
                // Gerar ObjectId se não existir
                if (string.IsNullOrEmpty(cache.Id))
                {
                    cache.Id = Guid.NewGuid().ToString();
                }

                var filter = Builders<ProtocolCacheDocument>.Filter.And(
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.Protocol, cache.Protocol),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.ProtocolId, cache.ProtocolId),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.WalletAddress, cache.WalletAddress),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.DataType, cache.DataType)
                );

                // Buscar documento existente para preservar o _id
                var existingDoc = await _collection.Find(filter).FirstOrDefaultAsync();
                if (existingDoc != null)
                {
                    // Preservar o _id do documento existente
                    cache.Id = existingDoc.Id;
                }

                var options = new ReplaceOptions { IsUpsert = true };
                await _collection.ReplaceOneAsync(filter, cache, options);

                _logger.LogDebug(
                    "Cache saved: Protocol={Protocol}, ProtocolId={ProtocolId}, Wallet={Wallet}, DataType={DataType}",
                    cache.Protocol, cache.ProtocolId, cache.WalletAddress, cache.DataType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving cache: Protocol={Protocol}, ProtocolId={ProtocolId}",
                    cache.Protocol, cache.ProtocolId);
                throw;
            }
        }

        public async Task<bool> ValidateCacheAsync(
            string protocol,
            string protocolId,
            Dictionary<string, object> currentValidationData)
        {
            try
            {
                var cache = await GetCacheAsync(protocol, protocolId, "", "");
                if (cache == null) return false;

                return ValidateHash(cache.ValidationHash, currentValidationData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating cache: Protocol={Protocol}, ProtocolId={ProtocolId}",
                    protocol, protocolId);
                return false;
            }
        }

        private bool ValidateHash(
            BsonDocument? cachedHash,
            Dictionary<string, object> currentHash)
        {
            if (cachedHash == null)
                return false;

            foreach (var key in currentHash.Keys)
            {
                if (!cachedHash.Contains(key))
                    return false;

                var cachedValue = cachedHash[key];
                var currentValue = currentHash[key];
                
                // Comparar valores simples
                if (cachedValue.IsString && currentValue is string currentStr)
                {
                    if (cachedValue.AsString != currentStr)
                        return false;
                }
                else if (cachedValue.IsInt32 && currentValue is int currInt)
                {
                    if (cachedValue.AsInt32 != currInt)
                        return false;
                }
            }

            return true;
        }

        public async Task InvalidateCacheAsync(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType,
            string reason = "manual")
        {
            try
            {
                var filter = Builders<ProtocolCacheDocument>.Filter.And(
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.Protocol, protocol),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.ProtocolId, protocolId),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.WalletAddress, walletAddress),
                    Builders<ProtocolCacheDocument>.Filter.Eq(d => d.DataType, dataType)
                );

                var update = Builders<ProtocolCacheDocument>.Update
                    .Set("cacheMetadata.isValid", false)
                    .Set("cacheMetadata.invalidationReason", reason)
                    .Set("cacheMetadata.lastValidatedAt", DateTime.UtcNow);

                await _collection.UpdateOneAsync(filter, update);

                _logger.LogInformation(
                    "Cache invalidated: Protocol={Protocol}, ProtocolId={ProtocolId}, Reason={Reason}",
                    protocol, protocolId, reason);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error invalidating cache: Protocol={Protocol}, ProtocolId={ProtocolId}",
                    protocol, protocolId);
            }
        }

        public async Task<List<ProtocolCacheDocument>> GetCachesByWalletAsync(
            string walletAddress,
            string? protocol = null,
            string? dataType = null)
        {
            try
            {
                var filterBuilder = Builders<ProtocolCacheDocument>.Filter;
                var filter = filterBuilder.Eq(d => d.WalletAddress, walletAddress);

                if (!string.IsNullOrEmpty(protocol))
                    filter = filterBuilder.And(filter, filterBuilder.Eq(d => d.Protocol, protocol));

                if (!string.IsNullOrEmpty(dataType))
                    filter = filterBuilder.And(filter, filterBuilder.Eq(d => d.DataType, dataType));

                return await _collection.Find(filter).ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting caches by wallet: {Wallet}", walletAddress);
                return new List<ProtocolCacheDocument>();
            }
        }

        public async Task<List<ProtocolCacheDocument>> GetCachesByTokenPairAsync(
            string tokenPair,
            string? protocol = null)
        {
            try
            {
                var filterBuilder = Builders<ProtocolCacheDocument>.Filter;
                var filter = filterBuilder.Eq("relatedIds.tokenPair", tokenPair);

                if (!string.IsNullOrEmpty(protocol))
                    filter = filterBuilder.And(filter, filterBuilder.Eq(d => d.Protocol, protocol));

                return await _collection.Find(filter).ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting caches by token pair: {TokenPair}", tokenPair);
                return new List<ProtocolCacheDocument>();
            }
        }



        public async Task<int> CleanupExpiredCachesAsync()
        {
            try
            {
                var filter = Builders<ProtocolCacheDocument>.Filter.Lt(
                    "cacheMetadata.expiresAt", 
                    DateTime.UtcNow);

                var result = await _collection.DeleteManyAsync(filter);

                if (result.DeletedCount > 0)
                {
                    _logger.LogInformation("Cleaned up {Count} expired caches", result.DeletedCount);
                }

                return (int)result.DeletedCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up expired caches");
                return 0;
            }
        }

        public async Task<int> CleanupStaleCachesAsync(int olderThanDays = 7)
        {
            try
            {
                var cutoffDate = DateTime.UtcNow.AddDays(-olderThanDays);
                var filter = Builders<ProtocolCacheDocument>.Filter.Lt(
                    "cacheMetadata.lastAccessedAt",
                    cutoffDate);

                var result = await _collection.DeleteManyAsync(filter);

                if (result.DeletedCount > 0)
                {
                    _logger.LogInformation(
                        "Cleaned up {Count} stale caches (older than {Days} days)",
                        result.DeletedCount, olderThanDays);
                }

                return (int)result.DeletedCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up stale caches");
                return 0;
            }
        }

        public async Task<Dictionary<string, CacheStats>> GetCacheStatsAsync()
        {
            try
            {
                var pipeline = new[]
                {
                    new BsonDocument("$group", new BsonDocument
                    {
                        { "_id", "$protocol" },
                        { "totalCaches", new BsonDocument("$sum", 1) },
                        { "validCaches", new BsonDocument("$sum", new BsonDocument("$cond", new BsonArray
                            {
                                "$cacheMetadata.isValid",
                                1,
                                0
                            }))
                        },
                        { "invalidCaches", new BsonDocument("$sum", new BsonDocument("$cond", new BsonArray
                            {
                                "$cacheMetadata.isValid",
                                0,
                                1
                            }))
                        },
                        { "totalAccesses", new BsonDocument("$sum", "$cacheMetadata.accessCount") },
                        { "avgApiDuration", new BsonDocument("$avg", "$cacheMetadata.apiCallDuration") },
                        { "avgAgeHours", new BsonDocument("$avg", new BsonDocument("$divide", new BsonArray
                            {
                                new BsonDocument("$subtract", new BsonArray
                                {
                                    DateTime.UtcNow,
                                    "$cacheMetadata.createdAt"
                                }),
                                3600000 // milliseconds to hours
                            }))
                        }
                    })
                };

                var results = await _collection.Aggregate<BsonDocument>(pipeline).ToListAsync();
                
                var stats = new Dictionary<string, CacheStats>();
                foreach (var doc in results)
                {
                    var protocol = doc["_id"].AsString;
                    stats[protocol] = new CacheStats
                    {
                        TotalCaches = doc["totalCaches"].AsInt32,
                        ValidCaches = doc["validCaches"].AsInt32,
                        InvalidCaches = doc["invalidCaches"].AsInt32,
                        TotalAccesses = doc["totalAccesses"].ToInt64(),
                        AvgApiDuration = doc["avgApiDuration"].ToDouble(),
                        AvgAgeHours = doc["avgAgeHours"].ToDouble()
                    };
                }

                return stats;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting cache stats");
                return new Dictionary<string, CacheStats>();
            }
        }
    }
}
