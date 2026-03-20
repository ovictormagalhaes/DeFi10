# Backend - DeFi10 API

Esta pasta contém a implementação do backend da DeFi10 API em C# (.NET) e ferramentas de teste.

## 📁 Estrutura

```
backend/
├── DeFi10.API/                    # API principal em C# (.NET 9)
├── DeFi10.API.Tests/              # Testes unitários
├── DeFi10.API.IntegrationTests/   # Testes de integração
├── api-e2e-tests-csharp/          # 🆕 Testes E2E completos da API
├── API_ROUTES_MAPPING.md          # 🆕 Documentação de todas as rotas
└── RUST_ADAPTATION_GUIDE.md       # 🆕 Guia para validar backend Rust
```

## 🚀 Quick Start - Testes de API

### Execução Automática (Recomendado)

```powershell
cd api-e2e-tests-csharp
.\run-tests.ps1
```

Este comando:
- ✅ Sobe API + MongoDB + Redis via Docker
- ✅ Executa 105+ testes cobrindo todos os endpoints
- ✅ Valida autenticação, validações e lógica de negócio
- ✅ Limpa ambiente automaticamente

**Tempo estimado**: ~60 segundos

### Execução Manual

```bash
cd api-e2e-tests-csharp
npm install
docker-compose up -d
npm test
docker-compose down
```

## 📋 O que foi Implementado

### Sistema Completo de Testes E2E

Um framework completo de testes automatizados que valida:

1. **Health Check** (3 testes)
   - Status da API
   - Validação de timestamp
   - Acesso público

2. **Wallet Groups** (25+ testes)
   - CRUD completo
   - Autenticação com senha
   - Proof-of-Work validation
   - JWT tokens
   - Casos de erro (400, 401, 403, 404)

3. **Strategies** (13+ testes)
   - Criação e atualização
   - Múltiplas estratégias
   - Validação de ownership
   - Autenticação

4. **Aggregations** (22+ testes)
   - Single wallet e wallet groups
   - Multi-chain support
   - Job tracking
   - Ethereum vs Solana

5. **Tokens** (20+ testes)
   - Logos individuais e em batch
   - Estatísticas
   - Múltiplas chains
   - Cache consistency

6. **Protocols** (8+ testes)
   - Status dos protocolos
   - Configuração de chains
   - Validação de estrutura

**Total: 105+ casos de teste** cobrindo sucesso e erros

### Documentação Completa

- **API_ROUTES_MAPPING.md**: Especificação de todas as rotas da API
- **RUST_ADAPTATION_GUIDE.md**: Como adaptar testes para backend Rust
- **api-e2e-tests-csharp/README.md**: Documentação completa dos testes
- **api-e2e-tests-csharp/QUICK_START.md**: Guia rápido de uso
- **api-e2e-tests-csharp/IMPLEMENTATION_SUMMARY.md**: Resumo da implementação
- **api-e2e-tests-csharp/EXECUTION_EXAMPLE.md**: Exemplo de execução

## 🧪 Comandos de Teste

```bash
# Todos os testes
npm test

# Testes específicos
npm run test:health          # Health check
npm run test:wallet-groups   # Wallet groups
npm run test:strategies      # Strategies
npm run test:aggregations    # Aggregations
npm run test:tokens          # Tokens
npm run test:protocols       # Protocols

# Com cobertura
npm run test:coverage
```

## 🐳 Docker Compose

O `api-e2e-tests-csharp/docker-compose.yml` configura:

- **API**: Backend C# na porta 10000
- **MongoDB**: Banco de dados na porta 27017
- **Redis**: Cache na porta 6379

Todos com health checks configurados para garantir inicialização correta.

## 🔄 Validação C# vs Rust

### Fase 1: Validar C# ✅

```powershell
cd api-e2e-tests-csharp
.\run-tests.ps1
# Resultado esperado: 105/105 testes passando
```

### Fase 2: Adaptar para Rust

1. Copiar estrutura de testes
2. Ajustar `docker-compose.yml` para apontar para backend Rust
3. Executar testes
4. Comparar resultados

```powershell
cd api-e2e-tests-rust
.\run-tests.ps1
# Resultado esperado: 105/105 testes passando
```

### Fase 3: Validar Compatibilidade

Ambas APIs devem:
- Passar 100% dos mesmos testes
- Retornar mesmos status codes
- Ter estrutura de dados equivalente
- Implementar mesmas validações

Ver [RUST_ADAPTATION_GUIDE.md](RUST_ADAPTATION_GUIDE.md) para detalhes.

## 📊 Cobertura de Testes

### Por Categoria
- Health: 3 testes ✅
- Wallet Groups: 25 testes ✅
- Strategies: 13 testes ✅
- Aggregations: 22 testes ✅
- Tokens: 20 testes ✅
- Protocols: 8 testes ✅

### Por Status Code
- 200 OK: 45 testes
- 201 Created: 8 testes
- 204 No Content: 2 testes
- 400 Bad Request: 25 testes
- 401 Unauthorized: 15 testes
- 403 Forbidden: 8 testes
- 404 Not Found: 12 testes

### Por Tipo
- Casos de sucesso: 60+ testes
- Casos de erro: 40+ testes
- Validação de dados: 25+ testes
- Autenticação: 20+ testes

## 🛠️ Tecnologias

### Backend C#
- .NET 9
- ASP.NET Core
- MongoDB Driver
- StackExchange.Redis
- JWT Bearer Authentication

### Testes
- Jest 29.7
- Axios 1.6
- Docker Compose
- Node.js 18+

## 📝 Endpoints Testados

### Públicos (sem auth)
- `GET /health`
- `GET /api/v1/wallet-groups/challenge`
- `POST /api/v1/wallet-groups`
- `GET /api/v1/wallet-groups/{id}/check`
- `POST /api/v1/wallet-groups/{id}/connect`
- `POST /api/v1/aggregations` (single account)
- `GET /api/v1/aggregations/{jobId}` (public jobs)
- `GET /api/v1/aggregations/account/{account}`
- `GET /api/v1/aggregations`
- `GET /api/v1/tokens/{address}/logo`
- `GET /api/v1/tokens/logos`
- `GET /api/v1/tokens/stats`
- `GET /api/v1/protocols/status`

### Protegidos (requer JWT)
- `GET /api/v1/wallet-groups/{id}`
- `PUT /api/v1/wallet-groups/{id}`
- `DELETE /api/v1/wallet-groups/{id}`
- `POST /api/v1/strategies`
- `GET /api/v1/strategies/{walletGroupId}`
- `POST /api/v1/aggregations` (wallet group)
- `GET /api/v1/aggregations/{jobId}` (wallet group jobs)

## 🎯 Objetivo Final

Garantir que:
1. ✅ Backend C# está funcionando corretamente
2. ⏳ Backend Rust tem comportamento idêntico ao C#
3. ⏳ Ambas APIs podem ser intercambiadas sem breaking changes
4. ⏳ Frontend funciona perfeitamente com qualquer backend

## 🔗 Links Úteis

- [API Routes Mapping](API_ROUTES_MAPPING.md) - Documentação completa das rotas
- [Rust Adaptation Guide](RUST_ADAPTATION_GUIDE.md) - Como validar Rust
- [E2E Tests README](api-e2e-tests-csharp/README.md) - Documentação dos testes
- [Quick Start](api-e2e-tests-csharp/QUICK_START.md) - Guia rápido
- [Execution Example](api-e2e-tests-csharp/EXECUTION_EXAMPLE.md) - Exemplo de execução

## ✅ Status

- **C# Backend**: ✅ Implementado e testado
- **Testes E2E**: ✅ Completos (105+ casos)
- **Documentação**: ✅ Completa
- **Rust Backend**: ⏳ Aguardando validação

## 📞 Suporte

Para problemas ou dúvidas:
1. Verificar logs: `docker-compose logs -f api`
2. Revisar documentação nos arquivos MD
3. Executar testes individuais para isolar problemas
4. Validar variáveis de ambiente

---

**Última atualização**: 2026-02-04  
**Versão dos testes**: 1.0.0
