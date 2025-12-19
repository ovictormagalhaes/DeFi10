using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure.MongoDB;
using DeFi10.API.Models.Persistence;
using DeFi10.API.Repositories.Interfaces;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.RegularExpressions;

namespace DeFi10.API.Repositories;

/// <summary>
/// MongoDB repository for token metadata operations
/// </summary>
public sealed class TokenMetadataRepository : ITokenMetadataRepository
{
    private readonly IMongoCollection<TokenMetadataDocument> _collection;
    private readonly ILogger<TokenMetadataRepository> _logger;
    private const string COLLECTION_NAME = "tokens";
    
    // Regex to remove emojis and special characters
    private static readonly Regex EmojiRegex = new Regex(
        @"[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]",
        RegexOptions.Compiled);
    
    /// <summary>
    /// Sanitizes token symbol or name by removing emojis and trimming whitespace
    /// </summary>
    private static string SanitizeText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;
        
        // Remove emojis and special unicode characters
        var cleaned = EmojiRegex.Replace(text, string.Empty);
        
        // Trim whitespace from start and end
        cleaned = cleaned.Trim();
        
        // Replace multiple spaces with single space
        cleaned = Regex.Replace(cleaned, @"\s+", " ");
        
        return cleaned;
    }

    public TokenMetadataRepository(
        IMongoDBContext context,
        ILogger<TokenMetadataRepository> logger)
    {
        _collection = context.GetCollection<TokenMetadataDocument>(COLLECTION_NAME);
        _logger = logger;
        
        EnsureIndexesAsync().GetAwaiter().GetResult();
    }

    private async Task EnsureIndexesAsync()
    {
        try
        {
            // Unique index on chain_id + address
            var chainAddressIndexKeys = Builders<TokenMetadataDocument>.IndexKeys
                .Ascending(t => t.ChainId)
                .Ascending(t => t.Address);
            var chainAddressIndex = new CreateIndexModel<TokenMetadataDocument>(
                chainAddressIndexKeys,
                new CreateIndexOptions { Unique = true, Name = "idx_chain_address" }
            );

            // Index on symbol + name for cross-chain lookups
            var symbolNameIndexKeys = Builders<TokenMetadataDocument>.IndexKeys
                .Ascending(t => t.Symbol)
                .Ascending(t => t.Name);
            var symbolNameIndex = new CreateIndexModel<TokenMetadataDocument>(
                symbolNameIndexKeys,
                new CreateIndexOptions { Name = "idx_symbol_name" }
            );

            // Index on symbol alone for fast symbol lookups
            var symbolIndexKeys = Builders<TokenMetadataDocument>.IndexKeys
                .Ascending(t => t.Symbol);
            var symbolIndex = new CreateIndexModel<TokenMetadataDocument>(
                symbolIndexKeys,
                new CreateIndexOptions { Name = "idx_symbol" }
            );

            await _collection.Indexes.CreateManyAsync(new[]
            {
                chainAddressIndex,
                symbolNameIndex,
                symbolIndex
            });

            _logger.LogInformation("[TokenMetadataRepo] Indexes created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[TokenMetadataRepo] Failed to create indexes (may already exist)");
        }
    }

    public async Task<IReadOnlyList<TokenMetadataDocument>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var tokens = await _collection
                .Find(FilterDefinition<TokenMetadataDocument>.Empty)
                .ToListAsync(cancellationToken);
            
            _logger.LogDebug("[TokenMetadataRepo] Retrieved {Count} tokens from database", tokens.Count);
            return tokens;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to get all tokens");
            throw;
        }
    }

    public async Task<TokenMetadataDocument?> GetByChainAndAddressAsync(int chainId, string address, CancellationToken cancellationToken = default)
    {
        try
        {
            var normalizedAddress = address.ToLowerInvariant();
            var filter = Builders<TokenMetadataDocument>.Filter.And(
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.ChainId, chainId),
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.Address, normalizedAddress)
            );

            var token = await _collection
                .Find(filter)
                .FirstOrDefaultAsync(cancellationToken);
            
            _logger.LogDebug("[TokenMetadataRepo] Get by chain+address: chainId={ChainId}, address={Address}, found={Found}",
                chainId, address, token != null);
            
            return token;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to get token by chain={ChainId} and address={Address}",
                chainId, address);
            throw;
        }
    }

    public async Task<IReadOnlyList<TokenMetadataDocument>> GetBySymbolAndNameAsync(string symbol, string name, CancellationToken cancellationToken = default)
    {
        try
        {
            var normalizedSymbol = SanitizeText(symbol).ToUpperInvariant();
            var normalizedName = SanitizeText(name).ToUpperInvariant();
            
            var filter = Builders<TokenMetadataDocument>.Filter.And(
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.Symbol, normalizedSymbol),
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.Name, normalizedName)
            );

            var tokens = await _collection
                .Find(filter)
                .ToListAsync(cancellationToken);
            
            _logger.LogDebug("[TokenMetadataRepo] Get by symbol+name: symbol={Symbol}, name={Name}, found={Count}",
                symbol, name, tokens.Count);
            
            return tokens;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to get tokens by symbol={Symbol} and name={Name}",
                symbol, name);
            throw;
        }
    }

    public async Task UpsertAsync(TokenMetadataDocument token, CancellationToken cancellationToken = default)
    {
        try
        {
            // Normalize and sanitize
            token.Address = token.Address.ToLowerInvariant();
            token.Symbol = SanitizeText(token.Symbol).ToUpperInvariant();
            token.Name = SanitizeText(token.Name).ToUpperInvariant();
            token.UpdatedAt = DateTime.UtcNow;

            var filter = Builders<TokenMetadataDocument>.Filter.And(
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.ChainId, token.ChainId),
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.Address, token.Address)
            );

            // Find existing document to preserve its Id and CreatedAt
            var existing = await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
            
            if (existing != null)
            {
                // Update existing document
                token.Id = existing.Id;
                token.CreatedAt = existing.CreatedAt;
                await _collection.ReplaceOneAsync(filter, token, cancellationToken: cancellationToken);
            }
            else
            {
                // Insert new document (MongoDB will auto-generate Id)
                await _collection.InsertOneAsync(token, cancellationToken: cancellationToken);
            }
            
            _logger.LogInformation("[TokenMetadataRepo] Upserted token: chain={ChainId}, address={Address}, symbol={Symbol}",
                token.ChainId, token.Address, token.Symbol);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to upsert token: chain={ChainId}, address={Address}",
                token.ChainId, token.Address);
            throw;
        }
    }

    public async Task BulkUpsertAsync(IEnumerable<TokenMetadataDocument> tokens, CancellationToken cancellationToken = default)
    {
        var tokenList = tokens.ToList();
        if (!tokenList.Any())
        {
            _logger.LogDebug("[TokenMetadataRepo] Bulk upsert skipped - no tokens provided");
            return;
        }

        try
        {
            // Normalize and sanitize all tokens first
            foreach (var token in tokenList)
            {
                token.Address = token.Address.ToLowerInvariant();
                token.Symbol = SanitizeText(token.Symbol).ToUpperInvariant();
                token.Name = SanitizeText(token.Name).ToUpperInvariant();
                token.UpdatedAt = DateTime.UtcNow;
            }
            
            // Build filters to check for existing documents
            var filters = tokenList.Select(t => 
                Builders<TokenMetadataDocument>.Filter.And(
                    Builders<TokenMetadataDocument>.Filter.Eq(x => x.ChainId, t.ChainId),
                    Builders<TokenMetadataDocument>.Filter.Eq(x => x.Address, t.Address)
                )
            ).ToList();
            
            var combinedFilter = Builders<TokenMetadataDocument>.Filter.Or(filters);
            var existingDocs = await _collection.Find(combinedFilter).ToListAsync(cancellationToken);
            
            // Create lookup dictionary by chain+address
            var existingByKey = existingDocs.ToDictionary(
                doc => $"{doc.ChainId}:{doc.Address}",
                doc => doc,
                StringComparer.OrdinalIgnoreCase
            );
            
            var bulkOps = new List<WriteModel<TokenMetadataDocument>>();
            
            foreach (var token in tokenList)
            {
                var key = $"{token.ChainId}:{token.Address}";
                
                if (existingByKey.TryGetValue(key, out var existing))
                {
                    // Update: preserve Id and CreatedAt
                    token.Id = existing.Id;
                    token.CreatedAt = existing.CreatedAt;
                    
                    var filter = Builders<TokenMetadataDocument>.Filter.Eq(t => t.Id, token.Id);
                    bulkOps.Add(new ReplaceOneModel<TokenMetadataDocument>(filter, token));
                }
                else
                {
                    // Insert: ensure new Guid
                    if (token.Id == Guid.Empty)
                        token.Id = Guid.NewGuid();
                    
                    bulkOps.Add(new InsertOneModel<TokenMetadataDocument>(token));
                }
            }

            var result = await _collection.BulkWriteAsync(bulkOps, new BulkWriteOptions { IsOrdered = false }, cancellationToken);
            
            _logger.LogInformation("[TokenMetadataRepo] Bulk upsert completed: {Count} tokens, {Inserted} inserted, {Modified} modified",
                tokenList.Count, result.InsertedCount, result.ModifiedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to bulk upsert {Count} tokens", tokenList.Count);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int chainId, string address, CancellationToken cancellationToken = default)
    {
        try
        {
            var normalizedAddress = address.ToLowerInvariant();
            var filter = Builders<TokenMetadataDocument>.Filter.And(
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.ChainId, chainId),
                Builders<TokenMetadataDocument>.Filter.Eq(t => t.Address, normalizedAddress)
            );

            var result = await _collection.DeleteOneAsync(filter, cancellationToken);
            
            _logger.LogInformation("[TokenMetadataRepo] Delete token: chain={ChainId}, address={Address}, deleted={Deleted}",
                chainId, address, result.DeletedCount > 0);
            
            return result.DeletedCount > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to delete token: chain={ChainId}, address={Address}",
                chainId, address);
            throw;
        }
    }

    public async Task<long> GetCountAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var count = await _collection.CountDocumentsAsync(
                FilterDefinition<TokenMetadataDocument>.Empty,
                cancellationToken: cancellationToken
            );
            
            _logger.LogDebug("[TokenMetadataRepo] Total tokens in database: {Count}", count);
            return count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataRepo] Failed to get token count");
            throw;
        }
    }
}
