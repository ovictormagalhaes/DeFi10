namespace DeFi10.API.Models;

/// <summary>
/// Tipos de estratégias de investimento DeFi.
/// </summary>
public enum StrategyType
{
    /// <summary>
    /// Tipo 1: Balancear tokens por peso/nota dentro de grupos.
    /// Ex: 50% BTC, 25% ETH, 25% SOL no grupo Lending.
    /// </summary>
    AllocationByWeight = 1,
    
    /// <summary>
    /// Tipo 2: Manter Health Factor em range seguro.
    /// </summary>
    HealthFactorTarget = 2,
    
    /// <summary>
    /// Tipo 3: Monitorar se pools LP estão in/out of range.
    /// </summary>
    LiquidityRangeMonitor = 3,
    
    /// <summary>
    /// Tipo 4: Manter APY mínimo em posições.
    /// </summary>
    YieldThreshold = 4,
    
    /// <summary>
    /// Tipo 5: Limitar concentração por protocolo.
    /// </summary>
    ProtocolDiversification = 5,
    
    /// <summary>
    /// Tipo 6: Balancear alocação por blockchain.
    /// </summary>
    ChainAllocation = 6,
    
    /// <summary>
    /// Tipo 7: Balancear por tipo de ativo (Wallet/LP/Lending/Staking).
    /// </summary>
    AssetTypeAllocation = 7
}
