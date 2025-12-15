using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Protocols.Raydium.Clmm.DTO;
using DeFi10.API.Services.Protocols.Raydium.Models;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm
{


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


        public async Task<RaydiumPoolInfo?> GetPoolInfoFromApiAsync(string poolId)
        {
            return await _apiService.GetPoolInfoAsync(poolId);
        }


        public async Task<List<RaydiumPosition>> GetPositionsByOwnerAsync(string ownerAddress)
        {

            _logger.LogDebug("Fetching positions on-chain for owner {Owner}", ownerAddress);
            return await _onChainService.GetPositionsAsync(ownerAddress);
        }
    }
}
