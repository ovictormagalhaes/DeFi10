using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models.Cache
{
    /// <summary>
    /// Documento genérico de cache para protocolos DeFi no MongoDB
    /// Suporta: Kamino, Aave, Raydium, Uniswap, etc.
    /// </summary>
    public class ProtocolCacheDocument
    {
        [BsonId]
        public string Id { get; set; } = null!;
        
        // ========== IDENTIFICAÇÃO E CONTEXTO ==========
        
        /// <summary>
        /// Nome do protocolo (kamino, aave, raydium, uniswap)
        /// </summary>
        [BsonElement("protocol")]
        public string Protocol { get; set; } = null!;
        
        /// <summary>
        /// ID composto específico do protocolo
        /// Ex: "market_obligation", "pool_abc123", "nft_12345"
        /// </summary>
        [BsonElement("protocolId")]
        public string ProtocolId { get; set; } = null!;
        
        /// <summary>
        /// Endereço da wallet do usuário
        /// </summary>
        [BsonElement("walletAddress")]
        public string WalletAddress { get; set; } = null!;
        
        /// <summary>
        /// Chain (solana, base, ethereum, arbitrum)
        /// </summary>
        [BsonElement("chain")]
        public string Chain { get; set; } = null!;
        
        /// <summary>
        /// Tipo de dado armazenado
        /// Ex: transaction_history, liquidity_events, position_history, rewards, uncollected_fees
        /// </summary>
        [BsonElement("dataType")]
        public string DataType { get; set; } = null!;
        
        // ========== RELACIONAMENTOS ==========
        
        /// <summary>
        /// IDs relacionados para queries complexas
        /// </summary>
        [BsonElement("relatedIds")]
        public RelatedIds RelatedIds { get; set; } = new();
        
        // ========== METADADOS ==========
        
        /// <summary>
        /// Versão do schema do body (para migrations)
        /// </summary>
        [BsonElement("version")]
        public string Version { get; set; } = "1.0";
        
        // ========== VALIDAÇÃO RÁPIDA ==========
        
        /// <summary>
        /// Hash de validação para cache hit/miss rápido (BsonDocument genérico)
        /// Use classes tipadas: KaminoValidationHash, AaveValidationHash, etc.
        /// </summary>
        [BsonElement("validationHash")]
        public BsonDocument? ValidationHash { get; set; }
        
        // ========== CACHE METADATA ==========
        
        /// <summary>
        /// Metadados do cache
        /// </summary>
        [BsonElement("cacheMetadata")]
        public CacheMetadata CacheMetadata { get; set; } = new();
        
        // ========== BODY (payload dinâmico) ==========
        
        /// <summary>
        /// Payload específico do protocolo (estrutura livre)
        /// </summary>
        [BsonElement("body")]
        public BsonDocument Body { get; set; } = new();
    }
    
    /// <summary>
    /// IDs relacionados para queries complexas
    /// </summary>
    public class RelatedIds
    {
        /// <summary>
        /// ID do market/pool principal (Kamino/Aave)
        /// </summary>
        [BsonElement("marketId")]
        public string? MarketId { get; set; }
        
        /// <summary>
        /// ID da posição específica
        /// </summary>
        [BsonElement("positionId")]
        public string? PositionId { get; set; }
        
        /// <summary>
        /// Endereço do pool (Raydium/Uniswap)
        /// </summary>
        [BsonElement("poolAddress")]
        public string? PoolAddress { get; set; }
        
        /// <summary>
        /// Par de tokens (ex: "SOL-USDC", "ETH-USDT")
        /// </summary>
        [BsonElement("tokenPair")]
        public string? TokenPair { get; set; }
    }
    
    /// <summary>
    /// Metadados do cache
    /// </summary>
    public class CacheMetadata
    {
        /// <summary>
        /// Data de criação do cache
        /// </summary>
        [BsonElement("createdAt")]
        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Última validação do cache
        /// </summary>
        [BsonElement("lastValidatedAt")]
        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime LastValidatedAt { get; set; } = DateTime.UtcNow;
        
        /// <summary>
        /// Duração da chamada API em ms
        /// </summary>
        [BsonElement("apiCallDuration")]
        public int ApiCallDuration { get; set; }
        
        /// <summary>
        /// Indica se o cache é válido
        /// </summary>
        [BsonElement("isValid")]
        public bool IsValid { get; set; } = true;
        
        /// <summary>
        /// Motivo da invalidação (se houver)
        /// Valores: "hash_mismatch", "expired", "manual", "api_changed"
        /// </summary>
        [BsonElement("invalidationReason")]
        public string? InvalidationReason { get; set; }
        
        /// <summary>
        /// TTL em horas (null = eterno)
        /// </summary>
        [BsonElement("ttlHours")]
        public int? TtlHours { get; set; }
        
        /// <summary>
        /// Data de expiração do cache (null = nunca expira)
        /// </summary>
        [BsonElement("expiresAt")]
        [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
        public DateTime? ExpiresAt { get; set; }
    }
}
