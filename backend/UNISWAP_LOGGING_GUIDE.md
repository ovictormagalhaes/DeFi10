# 📊 Logs Estratégicos Adicionados para Debugging do Uniswap

## Objetivo
Facilitar identificação de problemas no cálculo de uncollected fees e comportamento híbrido.

## Logs Implementados

### 1. UniswapV3Service.cs

#### GetActivePoolsHybridAsync
```csharp
Logger.LogInformation("[Uniswap Hybrid] Processing {PositionCount} positions for uncollected fees computation", 
    gql.Data.Positions.Count);

Logger.LogDebug("[Uniswap Hybrid] Fetching on-chain data for position {TokenId}", tokenId);

Logger.LogDebug("[Uniswap Hybrid] Position {TokenId} - RawTokensOwed0={Owed0}, RawTokensOwed1={Owed1}", 
    tokenId, dataResult.Position.TokensOwed0, dataResult.Position.TokensOwed1);
```

**O que revelar:**
- Quantas posições estão sendo processadas
- Quais dados on-chain estão sendo buscados
- Valores brutos retornados (TokensOwed vs calculated fees)

### 2. UniswapV3OnChainService.cs

#### TryGetPositionAsync
```csharp
_logger.LogDebug("[OnChain] Position {TokenId} retrieved - TokensOwed0={Owed0}, TokensOwed1={Owed1}, Liquidity={Liquidity}, FeeGrowthInside0Last={FG0}, FeeGrowthInside1Last={FG1}",
    id, positionResult.TokensOwed0, positionResult.TokensOwed1, positionResult.Liquidity, 
    positionResult.FeeGrowthInside0LastX128, positionResult.FeeGrowthInside1LastX128);
```

**O que revelar:**
- Estado bruto da posição do NFT Manager
- Fee growth inside last (para calcular delta)
- Liquidity (se 0, não há fees a calcular)

#### BuildFromIds (cálculo de fees)
```csharp
_logger.LogDebug("[OnChain Fees] Position {TokenId} - Initial TokensOwed0={Owed0}, TokensOwed1={Owed1} (scaled: {S0}, {S1})",
    id, pos.TokensOwed0, pos.TokensOwed1, finalOwed0, finalOwed1);

_logger.LogDebug("[OnChain Fees] Position {TokenId} - Calculating uncollected fees with FeeGrowthGlobal0={FG0}, FeeGrowthGlobal1={FG1}",
    id, fg.Value.Item1, fg.Value.Item2);

_logger.LogDebug("[OnChain Fees] Position {TokenId} - Calculated uncollected fees: Amount0={A0}, Amount1={A1} (was {O0}, {O1})",
    id, uncollected.Amount0, uncollected.Amount1, finalOwed0, finalOwed1);

_logger.LogWarning("[OnChain Fees] Position {TokenId} - FeeGrowth data not available, using raw TokensOwed only", id);
```

**O que revelar:**
- Valores iniciais (TokensOwed bruto)
- Se fee growth data está disponível
- **ANTES e DEPOIS** do cálculo de uncollected fees
- Quando o fallback é usado (sem fee growth data)

#### GetPositionDataSafeAsync
```csharp
_logger.LogInformation("[GetPositionDataSafe] TokenId={TokenId} returning TokensOwed0={Owed0}, TokensOwed1={Owed1}",
    tokenId, position.TokensOwed0, position.TokensOwed1);
```

**O que revelar:**
- **EXATAMENTE** quais valores estão sendo retornados ao caller
- Confirmar se são valores brutos ou calculados

### 3. UniswapV3Mapper.cs

#### ProcessPositionAsync
```csharp
_logger.LogDebug("[Mapper] Position {PositionId} - EstimatedUncollectedToken0={U0} (raw: {R0}), EstimatedUncollectedToken1={U1} (raw: {R1})",
    position.Id, position.EstimatedUncollectedToken0, position.RawTokensOwed0, 
    position.EstimatedUncollectedToken1, position.RawTokensOwed1);
```

**O que revelar:**
- Valores que o Mapper está usando para criar tokens
- Diferença entre `EstimatedUncollected` (pode ser calculado) e `RawTokensOwed` (bruto)

### 4. UncollectedFees.cs (já existe, mas importante)

```csharp
logger?.LogDebug("Calculating uncollected fees for position {TokenId} with liquidity {Liquidity}", 
    position.Nonce, position.Liquidity);

logger?.LogDebug("Final uncollected fees for position {TokenId} - Token0: {Amount0}, Token1: {Amount1}",
    position.Nonce, amount0, amount1);
```

**O que revelar:**
- Detalhes do cálculo matemático
- Valores finais calculados

## Como Usar os Logs

### Debug Mode On-Chain Puro
```bash
dotnet test --filter "FullyQualifiedName~UniswapIntegrationTests" --logger "console;verbosity=detailed"
```

Procure por:
1. `[OnChain] Position X retrieved` → Estado bruto
2. `[OnChain Fees] Position X - Initial TokensOwed` → Antes do cálculo
3. `[OnChain Fees] Position X - Calculating uncollected` → Durante cálculo
4. `[OnChain Fees] Position X - Calculated uncollected` → Resultado
5. `Final uncollected fees for position` → Valor final da fórmula

### Debug Mode Híbrido
```bash
# Configure appsettings.json com LogLevel: Debug
dotnet run --project DeFi10.API
```

Procure por:
1. `[Uniswap Hybrid] Processing N positions` → Quantas posições
2. `[Uniswap Hybrid] Fetching on-chain data` → Fetch iniciado
3. `[OnChain] Position X retrieved` → Dados brutos recebidos
4. `[GetPositionDataSafe] TokenId=X returning` → **VALORES FINAIS RETORNADOS**
5. `[Mapper] Position X - EstimatedUncollected` → O que vai para a API

### Identificar o Problema
Compare:
```
❌ MODO HÍBRIDO (ERRADO):
[Uniswap Hybrid] Position 4167184 - RawTokensOwed0=0, RawTokensOwed1=0
[GetPositionDataSafe] TokenId=4167184 returning TokensOwed0=0, TokensOwed1=0
[Mapper] Position 4167184 - EstimatedUncollectedToken0=0, EstimatedUncollectedToken1=0

✅ MODO ON-CHAIN (CORRETO):
[OnChain] Position 4167184 retrieved - TokensOwed0=0, TokensOwed1=0, Liquidity=156782281035351440
[OnChain Fees] Position 4167184 - Initial TokensOwed0=0, TokensOwed1=0 (scaled: 0, 0)
[OnChain Fees] Position 4167184 - Calculating uncollected fees with FeeGrowthGlobal0=757..., FeeGrowthGlobal1=220...
[OnChain Fees] Position 4167184 - Calculated uncollected fees: Amount0=2.28, Amount1=6856.39 (was 0, 0)
```

**Conclusão:** O modo híbrido para no passo 1 (dados brutos) e não executa passos 2-4 (cálculo).

## Métricas de Performance

Com os logs, também podemos medir:

### Latência de Operações
```
[Uniswap Hybrid] Fetching on-chain data for position 4167184 → START
[GetPositionDataSafe] TokenId=4167184 returning... → END
Δt = tempo de RPC call
```

### Chamadas RPC
Conte quantos logs `[OnChain] Position X retrieved` aparecem:
- **Modo Híbrido**: 1 call por posição (positions)
- **Modo On-Chain Puro**: 5-6 calls por posição (positions + pool state + ticks)

### Taxa de Sucesso
```
Posições com fees > 0: Count([OnChain Fees] Amount0 > 0 OR Amount1 > 0)
Posições sem liquidity: Count(Liquidity = 0)
Posições sem fee growth data: Count([OnChain Fees] FeeGrowth data not available)
```

## Troubleshooting Guide

### Sintoma: Uncollected fees sempre 0
**Logs para verificar:**
1. `[OnChain Fees] FeeGrowth data not available` → Pool state não acessível?
2. `Liquidity = 0` → Posição fechada
3. `[OnChain Fees] Calculated uncollected fees: Amount0=0` → Sem fees acumuladas ainda

### Sintoma: Diferença entre Hybrid e On-Chain
**Logs para comparar:**
```
Hybrid: [GetPositionDataSafe] TokenId=X returning TokensOwed0=A, TokensOwed1=B
OnChain: [OnChain Fees] Calculated uncollected fees: Amount0=C, Amount1=D

Se A != C ou B != D → CONFIRMA O BUG
```

### Sintoma: Performance ruim
**Logs para contar:**
```
Tempo total = [Uniswap Hybrid] Processing N positions → TEST END
Chamadas RPC = Count([OnChain] Position X retrieved)
Tempo médio por posição = Tempo total / N
```

## Níveis de Log Recomendados

### Production
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "DeFi10.API.Services.Protocols.Uniswap": "Warning"
    }
  }
}
```

### Development/Staging
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "DeFi10.API.Services.Protocols.Uniswap": "Debug"
    }
  }
}
```

### Integration Tests
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Trace",
      "DeFi10.API.Services.Protocols.Uniswap": "Trace"
    }
  }
}
```

## Próximos Passos
1. ✅ Logs implementados
2. ⏳ Validar logs em produção com dados reais
3. ⏳ Adicionar Application Insights custom events para métricas
4. ⏳ Criar dashboard de monitoramento de uncollected fees
