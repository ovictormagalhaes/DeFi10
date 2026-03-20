using DeFi10.API.Models.Cache;

namespace DeFi10.API.Repositories.Interfaces
{
    /// <summary>
    /// Repository genérico para cache de protocolos DeFi no MongoDB
    /// </summary>
    public interface IProtocolCacheRepository
    {
        /// <summary>
        /// Busca cache por chave composta
        /// </summary>
        /// <param name="protocol">Nome do protocolo (kamino, aave, raydium, uniswap)</param>
        /// <param name="protocolId">ID composto específico do protocolo</param>
        /// <param name="walletAddress">Endereço da wallet</param>
        /// <param name="dataType">Tipo de dado (transaction_history, liquidity_events, etc)</param>
        /// <returns>Documento de cache ou null se não encontrado</returns>
        Task<ProtocolCacheDocument?> GetCacheAsync(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType);
        
        /// <summary>
        /// Salva ou atualiza cache
        /// Se já existe (mesma chave composta), atualiza. Senão, cria novo.
        /// </summary>
        Task SaveCacheAsync(ProtocolCacheDocument cache);
        
        /// <summary>
        /// Valida se cache ainda é consistente comparando validationHash
        /// </summary>
        /// <param name="protocol">Nome do protocolo</param>
        /// <param name="protocolId">ID do protocolo</param>
        /// <param name="currentValidationData">Dados atuais para comparação</param>
        /// <returns>True se cache é válido, False se diverge</returns>
        Task<bool> ValidateCacheAsync(
            string protocol,
            string protocolId,
            Dictionary<string, object> currentValidationData);
        
        /// <summary>
        /// Invalida cache específico (marca como inválido)
        /// </summary>
        /// <param name="protocol">Nome do protocolo</param>
        /// <param name="protocolId">ID do protocolo</param>
        /// <param name="walletAddress">Endereço da wallet</param>
        /// <param name="dataType">Tipo de dado</param>
        /// <param name="reason">Motivo da invalidação</param>
        Task InvalidateCacheAsync(
            string protocol,
            string protocolId,
            string walletAddress,
            string dataType,
            string reason = "manual");
        
        /// <summary>
        /// Busca todos os caches de uma wallet
        /// </summary>
        /// <param name="walletAddress">Endereço da wallet</param>
        /// <param name="protocol">Filtro opcional por protocolo</param>
        /// <param name="dataType">Filtro opcional por tipo de dado</param>
        /// <returns>Lista de caches da wallet</returns>
        Task<List<ProtocolCacheDocument>> GetCachesByWalletAsync(
            string walletAddress,
            string? protocol = null,
            string? dataType = null);
        
        /// <summary>\n        /// Busca caches por token pair (ex: \"SOL-USDC\")\n        /// </summary>
        Task<List<ProtocolCacheDocument>> GetCachesByTokenPairAsync(
            string tokenPair,
            string? protocol = null);
        
        /// <summary>
        /// Atualiza lastAccessedAt e incrementa accessCount (para LRU e analytics)
        /// </summary>
        /// <param name="cacheId">ID do documento de cache</param>

        
        /// <summary>
        /// Remove caches expirados (expiresAt < agora)
        /// </summary>
        /// <returns>Quantidade de caches removidos</returns>
        Task<int> CleanupExpiredCachesAsync();
        
        /// <summary>
        /// Remove caches por LRU (menos acessados e mais antigos)
        /// </summary>
        /// <param name="olderThanDays">Remove caches não acessados há X dias</param>
        /// <returns>Quantidade de caches removidos</returns>
        Task<int> CleanupStaleCachesAsync(int olderThanDays = 7);
        
        /// <summary>
        /// Estatísticas de cache por protocolo
        /// </summary>
        Task<Dictionary<string, CacheStats>> GetCacheStatsAsync();
    }
    
    /// <summary>
    /// Estatísticas de cache
    /// </summary>
    public class CacheStats
    {
        public int TotalCaches { get; set; }
        public int ValidCaches { get; set; }
        public int InvalidCaches { get; set; }
        public long TotalAccesses { get; set; }
        public double AvgApiDuration { get; set; }
        public double AvgAgeHours { get; set; }
    }
}
