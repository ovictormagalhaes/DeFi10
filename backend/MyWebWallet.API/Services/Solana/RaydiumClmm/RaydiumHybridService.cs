using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using MyWebWallet.API.Services.Solana.DTO;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services.Solana.RaydiumClmm
{
    /// <summary>
    /// Service híbrido que tenta buscar dados da API do Raydium primeiro,
    /// com fallback para leitura on-chain direta
    /// </summary>
    public class RaydiumHybridService
    {
        private readonly RaydiumApiService _apiService;
        private readonly RaydiumOnChainService _onChainService;
        private readonly ILogger<RaydiumHybridService> _logger;

        public RaydiumHybridService(
            RaydiumApiService apiService,
            RaydiumOnChainService onChainService,
            ILogger<RaydiumHybridService> logger)
        {
            _apiService = apiService;
            _onChainService = onChainService;
            _logger = logger;
        }

        /// <summary>
        /// Busca informações de pool da API Raydium
        /// Retorna dados da API que incluem price, TVL, volume, APR, etc
        /// </summary>
        public async Task<RaydiumPoolInfo?> GetPoolInfoFromApiAsync(string poolId)
        {
            return await _apiService.GetPoolInfoAsync(poolId);
        }

        /// <summary>
        /// Busca posições on-chain (fallback se API não disponível)
        /// </summary>
        public async Task<List<RaydiumPosition>> GetPositionsByOwnerAsync(string ownerAddress)
        {
            // Por enquanto, API de posições não está disponível, usar on-chain direto
            _logger.LogInformation("Fetching positions on-chain for owner {Owner}", ownerAddress);
            return await _onChainService.GetPositionsAsync(ownerAddress);
        }
    }
}
