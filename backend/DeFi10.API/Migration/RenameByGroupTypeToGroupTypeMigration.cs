using MongoDB.Bson;
using MongoDB.Driver;
using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure.MongoDB;

namespace DeFi10.API.Migration;

/// <summary>
/// Migração para renomear campo byGroupType/ByGroupType para groupType na collection strategies
/// </summary>
public class RenameByGroupTypeToGroupTypeMigration
{
    private readonly IMongoCollection<BsonDocument> _collection;
    private readonly ILogger<RenameByGroupTypeToGroupTypeMigration> _logger;

    public RenameByGroupTypeToGroupTypeMigration(
        IMongoDBContext context,
        IOptions<MongoDBOptions> options,
        ILogger<RenameByGroupTypeToGroupTypeMigration> logger)
    {
        _logger = logger;
        var collectionName = options.Value.Collections.Strategies;
        _collection = context.Database.GetCollection<BsonDocument>(collectionName);
    }

    public async Task ExecuteAsync()
    {
        try
        {
            _logger.LogInformation("Starting migration: Rename byGroupType to groupType");

            // Encontrar todos os documentos que têm items com byGroupType ou ByGroupType
            var filter = Builders<BsonDocument>.Filter.Or(
                Builders<BsonDocument>.Filter.Exists("items.byGroupType"),
                Builders<BsonDocument>.Filter.Exists("items.ByGroupType")
            );

            var strategies = await _collection.Find(filter).ToListAsync();
            
            if (strategies.Count == 0)
            {
                _logger.LogInformation("No documents found with old field names. Migration skipped.");
                return;
            }

            _logger.LogInformation("Found {Count} strategies to migrate", strategies.Count);

            int updatedCount = 0;

            foreach (var strategy in strategies)
            {
                if (!strategy.Contains("items") || !strategy["items"].IsBsonArray)
                    continue;

                var items = strategy["items"].AsBsonArray;
                bool needsUpdate = false;

                for (int i = 0; i < items.Count; i++)
                {
                    var item = items[i].AsBsonDocument;

                    // Renomear byGroupType (camelCase) para groupType
                    if (item.Contains("byGroupType"))
                    {
                        item["groupType"] = item["byGroupType"];
                        item.Remove("byGroupType");
                        needsUpdate = true;
                    }
                    // Renomear ByGroupType (PascalCase) para groupType
                    else if (item.Contains("ByGroupType"))
                    {
                        item["groupType"] = item["ByGroupType"];
                        item.Remove("ByGroupType");
                        needsUpdate = true;
                    }
                }

                if (needsUpdate)
                {
                    var updateFilter = Builders<BsonDocument>.Filter.Eq("_id", strategy["_id"]);
                    var update = Builders<BsonDocument>.Update.Set("items", items);
                    
                    await _collection.UpdateOneAsync(updateFilter, update);
                    updatedCount++;
                }
            }

            _logger.LogInformation("Migration completed: {UpdatedCount} strategies updated", updatedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Migration failed: Rename byGroupType to groupType");
            throw;
        }
    }
}
