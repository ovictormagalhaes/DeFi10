# Configuração do Infura para EthereumService

## Passos para configurar:

### 1. Criar conta no Infura
1. Acesse [infura.io](https://infura.io)
2. Crie uma conta gratuita
3. Crie um novo projeto para Ethereum
4. Copie o **Project ID**

### 2. Configurar no projeto
- Substitua `YOUR_INFURA_PROJECT_ID` nos arquivos `appsettings.json` e `appsettings.Development.json` pelo seu Project ID

**Estrutura simplificada da configuração:**{
  "Infura": {
    "ProjectId": "seu-project-id-aqui",
    "Url": "https://mainnet.infura.io/v3/"
  }
}
- Para desenvolvimento sem configurar Infura, o sistema usará dados simulados automaticamente

### 3. Plano gratuito do Infura
- **100.000 requisições/dia**
- **Perfeito para desenvolvimento**
- **Sem cartão de crédito necessário**

### 4. Endereços para teste
- Vitalik Buterin: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
- Uniswap Router: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`

### 5. Funcionalidades implementadas
? Saldo de ETH nativo via `eth_getBalance`  
? Saldos de tokens ERC-20 via `eth_call` com `balanceOf`  
? Tokens populares: USDC, USDT, WBTC, MATIC, LINK  
? Tratamento de erros com fallback para dados simulados  
? Validação de endereços Ethereum  
? Conversão de unidades (Wei para ETH, token units para decimais)  

### 6. Como funciona
- Se `Infura:ProjectId` estiver configurado corretamente ? usa dados reais da blockchain
- Se não configurado ou inválido ? usa dados simulados para desenvolvimento
- Em caso de erro na API ? fallback automático para dados simulados

### 7. Vantagens da nova estrutura
? **Configuração mais limpa** - `Infura:ProjectId` ao invés de `Blockchain:Ethereum:InfuraProjectId`  
? **Facilita expansão** - Pode adicionar outras APIs como `Alchemy: