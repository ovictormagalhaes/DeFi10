using DeFi10.API.Models.Cache;
using DeFi10.API.Repositories.Interfaces;
using MongoDB.Bson;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace DeFi10.API.Services.Cache
{
    /// <summary>
    /// Helper service para operações de cache de protocolos
    /// </summary>
    public class ProtocolCacheHelper
    {
        private readonly IProtocolCacheRepository _cacheRepo;
        private readonly ILogger<ProtocolCacheHelper> _logger;

        public ProtocolCacheHelper(
            IProtocolCacheRepository cacheRepo,
            ILogger<ProtocolCacheHelper> logger)
        {
            _cacheRepo = cacheRepo;
            _logger = logger;
        }

        /// <summary>
        /// Obtém o documento de cache completo (incluindo ValidationHash)
        /// </summary>
        public async Task<ProtocolCacheDocument?> GetCacheDocumentAsync(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType)
        {
            try
            {
                return await _cacheRepo.GetCacheAsync(protocol, protocolId, walletAddress, dataType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting cache document: {Protocol}/{ProtocolId}", protocol, protocolId);
                return null;
            }
        }

        /// <summary>
        /// Tenta obter dados do cache. Se inválido ou expirado, retorna null.
        /// </summary>
        public async Task<TBody?> GetFromCacheAsync<TBody>(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType,
            Dictionary<string, object> currentValidationHash) where TBody : class
        {
            try
            {
                var cached = await _cacheRepo.GetCacheAsync(
                    protocol, protocolId, walletAddress, dataType);

                if (cached == null)
                {
                    _logger.LogDebug("Cache MISS - not found: {Protocol}/{ProtocolId}", protocol, protocolId);
                    return null;
                }

                // Verificar expiração
                if (DateTime.UtcNow > cached.CacheMetadata.ExpiresAt)
                {
                    _logger.LogDebug("Cache MISS - expired: {Protocol}/{ProtocolId}", protocol, protocolId);
                    return null;
                }

                // Verificar se está marcado como inválido
                if (!cached.CacheMetadata.IsValid)
                {
                    _logger.LogDebug("Cache MISS - invalid: {Protocol}/{ProtocolId}, Reason: {Reason}", 
                        protocol, protocolId, cached.CacheMetadata.InvalidationReason);
                    return null;
                }

                // Validar hash
                if (!ValidateHash(cached.ValidationHash, currentValidationHash))
                {
                    _logger.LogWarning("Cache MISS - hash mismatch: {Protocol}/{ProtocolId}", protocol, protocolId);
                    
                    // Invalidar cache automaticamente
                    await _cacheRepo.InvalidateCacheAsync(
                        protocol, protocolId, walletAddress, dataType, "hash_mismatch");
                    
                    return null;
                }

                // Cache HIT!
                var age = DateTime.UtcNow - cached.CacheMetadata.CreatedAt;
                _logger.LogInformation(
                    "Cache HIT: {Protocol}/{ProtocolId}, Age: {Age:F1}h",
                    protocol, protocolId, age.TotalHours);

                // Deserializar body
                return DeserializeBody<TBody>(cached.Body);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting from cache: {Protocol}/{ProtocolId}", protocol, protocolId);
                return null;
            }
        }

        /// <summary>
        /// Salva dados no cache
        /// </summary>
        public async Task SaveToCacheAsync<TBody, TValidationHash>(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType,
            string chain,
            TBody body,
            TValidationHash validationHash,
            int apiCallDuration,
            int ttlHours,
            RelatedIds? relatedIds = null) 
            where TBody : class
            where TValidationHash : class
        {
            try
            {
                var cache = new ProtocolCacheDocument
                {
                    Protocol = protocol,
                    ProtocolId = protocolId,
                    WalletAddress = walletAddress,
                    Chain = chain,
                    DataType = dataType,
                    
                    // Serializa via JSON para BsonDocument (evita _t/_v)
                    ValidationHash = SerializeValidationHash(validationHash),
                    
                    RelatedIds = relatedIds ?? new RelatedIds(),
                    
                    CacheMetadata = new CacheMetadata
                    {
                        CreatedAt = DateTime.UtcNow,
                        LastValidatedAt = DateTime.UtcNow,
                        ApiCallDuration = apiCallDuration,
                        IsValid = true,
                        TtlHours = null,
                        ExpiresAt = null
                    },
                    
                    Body = SerializeBody(body)
                };

                await _cacheRepo.SaveCacheAsync(cache);

                _logger.LogInformation(
                    "Cache SAVED: {Protocol}/{ProtocolId}, TTL: eternal, API Duration: {Duration}ms",
                    protocol, protocolId, apiCallDuration);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving to cache: {Protocol}/{ProtocolId}", protocol, protocolId);
            }
        }

        /// <summary>
        /// Serializa validation hash para BsonDocument via JSON (evita _t/_v)
        /// </summary>
        private BsonDocument SerializeValidationHash<T>(T validationHash) where T : class
        {
            var json = JsonSerializer.Serialize(validationHash, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });
            return BsonDocument.Parse(json);
        }

        /// <summary>
        /// Deserializa BsonDocument para tipo específico de ValidationHash
        /// </summary>
        public T? DeserializeValidationHash<T>(BsonDocument? document) where T : class
        {
            if (document == null) return null;
            
            var json = document.ToJson();
            return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true
            });
        }

        /// <summary>
        /// Valida hash com tolerância para valores decimais
        /// </summary>
        private bool ValidateHash(
            BsonDocument? cachedHash,
            Dictionary<string, object> currentHash,
            decimal tolerance = 0.0001m)
        {
            if (cachedHash == null)
                return false;

            foreach (var key in currentHash.Keys)
            {
                var cachedValue = GetCachedValue(cachedHash, key);
                if (cachedValue == null)
                    return false;

                // Para valores decimais, usar tolerância
                if (TryConvertToDecimal(currentHash[key], out var currentDecimal) && 
                    TryConvertToDecimal(cachedValue, out var cachedDecimal))
                {
                    var diff = Math.Abs(currentDecimal - cachedDecimal);
                    var maxDiff = currentDecimal * tolerance;

                    if (diff > maxDiff)
                    {
                        _logger.LogDebug(
                            "Hash validation failed - {Key}: {Cached} != {Current} (diff: {Diff})",
                            key, cachedDecimal, currentDecimal, diff);
                        return false;
                    }
                }
                else if (!AreEqual(currentHash[key], cachedValue))
                {
                    return false;
                }
            }

            return true;
        }

        private object? GetCachedValue(BsonDocument hash, string key)
        {
            if (!hash.Contains(key))
                return null;
                
            var value = hash[key];
            
            if (value.IsString) return value.AsString;
            if (value.IsInt32) return value.AsInt32;
            if (value.IsInt64) return value.AsInt64;
            if (value.IsDouble) return value.AsDouble;
            if (value.IsBoolean) return value.AsBoolean;
            if (value.IsBsonDateTime) return value.ToUniversalTime();
            
            return value.ToString();
        }

        private bool TryConvertToDecimal(object value, out decimal result)
        {
            result = 0;
            
            if (value is decimal decimalValue)
            {
                result = decimalValue;
                return true;
            }
            
            if (value is double doubleValue)
            {
                result = (decimal)doubleValue;
                return true;
            }
            
            if (value is int intValue)
            {
                result = intValue;
                return true;
            }
            
            if (value is long longValue)
            {
                result = longValue;
                return true;
            }
            
            return decimal.TryParse(value?.ToString(), out result);
        }

        private bool AreEqual(object obj1, object obj2)
        {
            if (obj1 == null && obj2 == null) return true;
            if (obj1 == null || obj2 == null) return false;
            
            return obj1.Equals(obj2) || obj1.ToString() == obj2.ToString();
        }

        /// <summary>
        /// Serializa objeto para BsonDocument
        /// </summary>
        private BsonDocument SerializeBody<TBody>(TBody body) where TBody : class
        {
            var json = JsonSerializer.Serialize(body, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });
            
            // Se for array, envelopa em objeto {"data": [...]}
            if (json.TrimStart().StartsWith("["))
            {
                json = $"{{\"data\":{json}}}";
            }
            
            return BsonDocument.Parse(json);
        }

        /// <summary>
        /// Deserializa BsonDocument para objeto
        /// </summary>
        private TBody? DeserializeBody<TBody>(BsonDocument document) where TBody : class
        {
            var json = document.ToJson();
            
            // Se tiver envelope {"data": [...]}, extrai apenas o array
            // IMPORTANTE: Só desembrulhar se "data" for um ARRAY, não um objeto
            if (document.Contains("data") && document.ElementCount == 1)
            {
                var dataElement = document["data"];
                if (dataElement.BsonType == MongoDB.Bson.BsonType.Array)
                {
                    json = dataElement.ToJson();
                }
            }
            
            return JsonSerializer.Deserialize<TBody>(json, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true
            });
        }

        /// <summary>
        /// Gera hash checksum dos dados críticos
        /// </summary>
        public string GenerateChecksumHash(Dictionary<string, object> data)
        {
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            using var md5 = MD5.Create();
            var hashBytes = md5.ComputeHash(Encoding.UTF8.GetBytes(json));
            return Convert.ToHexString(hashBytes).ToLowerInvariant();
        }
    }
}
