# Migração para Moralis API

## Configuração do Moralis

### 1. Criar conta no Moralis
1. Acesse [moralis.io](https://moralis.io)
2. Crie uma conta gratuita
3. Vá para "Web3 APIs" 
4. Copie sua **API Key**

### 2. Configurar no projeto
Substitua `YOUR_MORALIS_API_KEY` nos arquivos de configuração:

```json
{
  "Moralis": {
    "ApiKey": "sua-moralis-api-key-aqui",
    "BaseUrl": "https://deep-index.moralis.io/api/v2.2"
  }
}
```

### 3. Plano gratuito do Moralis
- **40.000 requests/mês**
- **Perfeito para desenvolvimento**
- **Descoberta automática de tokens**
- **Sem cartão de crédito necessário**

## Funcionalidades Implementadas

### ? **ETH Balance**
- Endpoint: `/{address}/balance?chain=eth`
- Conversão automática de Wei para ETH

### ? **ERC-20 Token Discovery**
- Endpoint: `/{address}/erc20?chain=eth&limit=100`
- Descoberta automática de TODOS os tokens
- Paginação automática para carteiras com muitos tokens
- Filtragem de tokens com saldo insignificante (< 0.000001)

### ? **Metadados dos Tokens**
- Symbol, Name, Decimals incluídos automaticamente
- Conversão correta de unidades de acordo com os decimais

### ? **Paginação Inteligente**
- Suporte a cursors para grandes listas de tokens
- Limite de 500 tokens por carteira para performance
- Tratamento robusto de erros

## Vantagens da Migração

### ?? **Performance**
- **API REST** ao invés de JSON-RPC
- **Dados pré-indexados** pelo Moralis
- **Paginação eficiente** para grandes carteiras

### ?? **Descoberta Completa**
- **Automática**: Não precisa listar tokens conhecidos
- **Dinâmica**: Descobre tokens novos automaticamente
- **Abrangente**: Inclui todos os ERC-20 tokens

### ??? **Confiabilidade**
- **99.9% uptime** garantido
- **Rate limiting** inteligente
- **Erro handling** robusto

### ?? **Dados Ricos**
- **Metadados completos** dos tokens
- **Balances precisos** com decimais corretos
- **Contratos verificados** automaticamente

## Exemplos de Tokens Descobertos

Com Moralis, você automaticamente terá acesso a:
- **Stablecoins**: USDC, USDT, DAI, FRAX
- **Wrapped Tokens**: WETH, WBTC, cbBTC
- **DeFi Tokens**: UNI, AAVE, LINK, SUSHI
- **Meme Coins**: SHIB, PEPE, APE
- **Layer 2**: OP, MATIC, ARB
- **E qualquer outro token ERC-20**

## Migração Completa

### ? **Removido:**
- Infura integration
- Alchemy integration
- Lista manual de tokens conhecidos
- JSON-RPC complexity

### ? **Adicionado:**
- Moralis REST API integration
- Descoberta automática de tokens
- Paginação para grandes carteiras
- Metadados completos dos tokens
- ETH balance via Moralis

## Como Testar

1. Configure sua Moralis API Key
2. Use um endereço real do Ethereum como teste:
   - Vitalik: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`
   - Uniswap: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`

3. O sistema retornará TODOS os tokens que a carteira possui!

## Resultado

Agora o EthereumService usa exclusivamente **Moralis** para descobrir todos os tokens de uma carteira Ethereum de forma automática e eficiente! ??