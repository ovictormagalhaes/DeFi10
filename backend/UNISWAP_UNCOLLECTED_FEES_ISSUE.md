# 🐛 Problema: Uncollected Fees não calculados corretamente no modo híbrido Uniswap

## Status
✅ **CORRIGIDO** - Implementação completa e testada

## Descrição
O modo híbrido do Uniswap (GraphQL + On-chain) não está calculando corretamente os **uncollected fees**. 

### Comportamento Atual
- **Modo Híbrido**: Retorna `TokensOwed0/1 = 0` (apenas fees coletadas mas não sacadas)
- **Modo On-Chain Puro**: Calcula corretamente usando fórmula complexa com tick data

### Evidência do Teste
```
Posição 4167184 (WETH-USDC):
  Modo Híbrido:  uncol0 = 0         uncol1 = 0            ❌ ERRADO
  Modo On-Chain: uncol0 = 2.28 WETH uncol1 = 6856.39 USDC ✅ CORRETO

Posição 4248708 (WETH-USDC):
  Modo Híbrido:  uncol0 = 0          uncol1 = 0            ❌ ERRADO
  Modo On-Chain: uncol0 = 0.04 WETH  uncol1 = 113.05 USDC  ✅ CORRETO
```

## Causa Raiz

### Arquitetura Atual
```
UniswapV3Service.GetActivePoolsHybridAsync()
  ├─ ExecuteGraphQueryAsync() → Retorna posições do GraphQL
  └─ Para cada posição:
       └─ GetPositionDataSafeAsync(tokenId) → Retorna PositionDTO bruto
            ├─ TryGetPositionAsync() → Chama positions(tokenId) no NFT Manager
            └─ Retorna { TokensOwed0, TokensOwed1 } ← APENAS FEES JÁ COLETADAS!
```

### O que está faltando
O cálculo completo de uncollected fees requer:

1. **Pool State Data**:
   - `feeGrowthGlobal0X128`
   - `feeGrowthGlobal1X128`
   - `currentTick`

2. **Tick Data**:
   - `lowerTick.feeGrowthOutside0X128`
   - `lowerTick.feeGrowthOutside1X128`
   - `upperTick.feeGrowthOutside0X128`
   - `upperTick.feeGrowthOutside1X128`

3. **Cálculo** (implementado em `UncollectedFees.CalculateUncollectedFees`):
   ```csharp
   feeGrowthInside = CalculateFeeGrowthInside(
       tickLower, tickUpper, currentTick,
       feeGrowthGlobal, feeGrowthOutsideLower, feeGrowthOutsideUpper
   );
   
   feeGrowthDelta = feeGrowthInside - position.FeeGrowthInsideLast;
   feesEarned = (liquidity * feeGrowthDelta) / Q128;
   totalOwed = TokensOwed + feesEarned;
   ```

### Onde funciona corretamente
`UniswapV3OnChainService.GetActivePoolsOnChainAsync()`:
```csharp
// Busca pool state
var fg = TryGetFeeGrowthAsync(pool); // feeGrowthGlobal0/1

// Busca tick data
var lowerTick = TryGetTickAsync(pool, pos.TickLower);
var upperTick = TryGetTickAsync(pool, pos.TickUpper);

// Calcula uncollected fees
var uncollected = new UncollectedFees().CalculateUncollectedFees(
    pos, fg.Item1, fg.Item2, dec0, dec1, currentTick, 
    lowerTick, upperTick, logger
);

finalOwed0 = uncollected.Amount0; // ✅ VALOR CORRETO
finalOwed1 = uncollected.Amount1; // ✅ VALOR CORRETO
```

## Solução Proposta

### Opção 1: Modificar GetPositionDataSafeAsync (Recomendada)
Adicionar opção para calcular uncollected fees:

```csharp
public async Task<PositionDataResult> GetPositionDataSafeAsync(
    BigInteger tokenId, 
    ChainEnum chain, 
    bool calculateUncollectedFees = false)
{
    var position = await TryGetPositionAsync(ctx, tokenId);
    
    if (calculateUncollectedFees && position.Liquidity > 0)
    {
        var pool = await ResolvePoolAsync(ctx, position.Token0, position.Token1, position.Fee);
        var slot0 = await TryGetSlot0Async(ctx, pool);
        var fg = await TryGetFeeGrowthAsync(ctx, pool);
        var lowerTick = await TryGetTickAsync(ctx, pool, position.TickLower);
        var upperTick = await TryGetTickAsync(ctx, pool, position.TickUpper);
        
        var uncollected = new UncollectedFees().CalculateUncollectedFees(
            position, fg.Item1, fg.Item2, dec0, dec1, 
            slot0.Tick, lowerTick, upperTick, logger
        );
        
        // Sobrescrever TokensOwed com valores calculados
        position.TokensOwed0 = (BigInteger)(uncollected.Amount0 * Math.Pow(10, dec0));
        position.TokensOwed1 = (BigInteger)(uncollected.Amount1 * Math.Pow(10, dec1));
    }
    
    return PositionDataResult.CreateSuccess(tokenId, position, poolAddress);
}
```

E no `UniswapV3Service`:
```csharp
var dataResult = await _onChainService.GetPositionDataSafeAsync(
    tokenId, 
    chain, 
    calculateUncollectedFees: true // ✅ HABILITAR CÁLCULO
);
```

### Opção 2: Criar método híbrido específico
Criar `GetPositionDataWithFeesAsync` que já retorna fees calculados.

### Opção 3: Modificar UniswapV3Service diretamente
Replicar a lógica de cálculo dentro do `GetActivePoolsHybridAsync`.

## Impacto

### Onde afeta
- ✅ **Modo On-Chain Puro**: Funciona corretamente
- ❌ **Modo Híbrido (GraphQL + On-chain)**: **NÃO funciona**
- ❌ **API Endpoint** `/api/aggregation/wallet/{address}`: Usa modo híbrido quando disponível

### Gravidade
- **ALTA**: Usuários veem $0 em uncollected fees quando deveriam ver valores reais
- Afeta decisões financeiras (quando coletar fees)
- Relatórios financeiros incorretos

## Teste
Executar:
```powershell
dotnet test --filter "FullyQualifiedName~Should_Return_Collected_And_Uncollected_Fees_From_UniswapGraphQL"
```

Verificar comparação Hybrid vs On-Chain no output.

## Logs Adicionados
- `[Uniswap Hybrid] Processing {PositionCount} positions`
- `[Uniswap Hybrid] Position {TokenId} - RawTokensOwed0={Owed0}, RawTokensOwed1={Owed1}`
- `[OnChain] Position {TokenId} retrieved - TokensOwed0={...}`
- `[OnChain Fees] Position {TokenId} - Initial TokensOwed...`
- `[OnChain Fees] Position {TokenId} - Calculating uncollected fees...`
- `[Mapper] Position {PositionId} - EstimatedUncollectedToken0={...}`

## Próximos Passos
1. ✅ Confirmar problema com teste
2. ✅ Implementar solução (método GetPositionWithCalculatedFeesAsync)
3. ✅ Testar solução
4. ⏳ Monitorar performance em produção (4-5 chamadas RPC extras por posição)
5. ⏳ Considerar cache para pool state/tick data

## Solução Implementada

### Mudanças Realizadas

1. **Interface `IUniswapV3OnChainService`**: Adicionado método `GetPositionWithCalculatedFeesAsync`
   - [IUniswapV3OnChainService.cs](DeFi10.API/Services/Protocols/Uniswap/IUniswapV3OnChainService.cs)

2. **Implementação `UniswapV3OnChainService`**: Criado método que calcula fees reais
   - [UniswapV3OnChainService.cs](DeFi10.API/Services/Protocols/Uniswap/UniswapV3OnChainService.cs)
   - Busca pool state (feeGrowthGlobal0/1, currentTick)
   - Busca tick data (lowerTick, upperTick)
   - Calcula uncollected fees usando `UncollectedFees.CalculateUncollectedFees`
   - Atualiza `TokensOwed0/1` com valores calculados

3. **Serviço `UniswapV3Service`**: Modificado para usar novo método
   - [UniswapV3Service.cs](DeFi10.API/Services/Protocols/Uniswap/UniswapV3Service.cs)
   - `GetActivePoolsHybridAsync` agora chama `GetPositionWithCalculatedFeesAsync`

### Resultado
✅ Modo híbrido agora retorna uncollected fees corretos
✅ Teste de integração passa com sucesso
✅ Logs adicionados para debugging
