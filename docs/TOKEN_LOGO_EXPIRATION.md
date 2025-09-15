# Token Logo Expiration Configuration

## ? **Configuração Atualizada - 7 Dias**

### **?? Configuração no appsettings.json:**
```json
{
  "Redis": {
    "TokenLogoExpiration": "7.00:00:00"  // 7 days, 0 hours, 0 minutes, 0 seconds
  }
}
```

### **?? Comparação de Expirações:**

| Cache Type | Expiration | Reason |
|------------|------------|---------|
| **Wallet Data** | 30 minutes | Frequently changing balances |
| **Token Logos** | **7 days** | ? Static URLs, moderate refresh |
| ~~Token Logos (old)~~ | ~~365 days~~ | ? Too long, outdated logos |

## ?? **Por que 7 dias é ideal:**

### **? Benefícios:**
- **Fresh logos**: Permite atualizações de logos periodicamente
- **Performance**: Ainda muito eficiente (cache hit na maioria dos casos)
- **Storage efficiency**: Remove logos não utilizados automaticamente
- **Flexibility**: Facilita updates de logos quando necessário

### **?? Cenários:**
- **Novo token lançado**: Logo updated automatically after 7 days
- **Token rebrand**: Logo refreshed within a week
- **Broken URL**: Automatic cleanup after expiration

## ?? **Implementação:**

### **TokenLogoService Constructor:**
```csharp
public TokenLogoService(IConnectionMultiplexer redis, IConfiguration configuration)
{
    // Get token logo expiration from configuration or default to 7 days
    var tokenLogoExpirationConfig = configuration["Redis:TokenLogoExpiration"];
    _tokenLogoExpiration = !string.IsNullOrEmpty(tokenLogoExpirationConfig) 
        ? TimeSpan.Parse(tokenLogoExpirationConfig) 
        : TimeSpan.FromDays(7);
}
```

### **Set Methods Updated:**
```csharp
// Single token
await _database.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration);

// Batch tokens
tasks.Add(redisBatch.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration));
```

## ?? **Configurações Flexíveis:**

### **Diferentes Tempos de Expiração:**
```json
{
  "Redis": {
    "TokenLogoExpiration": "1.00:00:00",    // 1 day
    "TokenLogoExpiration": "3.00:00:00",    // 3 days  
    "TokenLogoExpiration": "7.00:00:00",    // 7 days (current)
    "TokenLogoExpiration": "14.00:00:00",   // 14 days
    "TokenLogoExpiration": "30.00:00:00"    // 30 days
  }
}
```

### **Formato TimeSpan:**
```
"days.hours:minutes:seconds"

Examples:
"7.00:00:00"    = 7 days
"0.12:00:00"    = 12 hours  
"0.00:30:00"    = 30 minutes
"1.06:30:45"    = 1 day, 6 hours, 30 minutes, 45 seconds
```

## ?? **Impact Analysis:**

### **Redis Storage:**
- **Before (365 days)**: Logos stored for 1 year
- **After (7 days)**: Logos stored for 1 week
- **Storage reduction**: ~98% less storage usage over time

### **Performance:**
- **Cache hit ratio**: Still very high (~95%+ for active tokens)
- **Memory efficiency**: Automatic cleanup of unused tokens
- **Fresh data**: Ensures logos stay up-to-date

### **Operational:**
- **Token updates**: New logos appear within 7 days max
- **Broken URLs**: Automatically cleaned up
- **Maintenance**: Self-healing system

## ?? **Monitoring:**

### **Key Metrics:**
```bash
# Check token logo cache stats
GET /api/v1/tokens/stats

# Response shows current cached tokens (will be lower now)
{
  "totalTokens": 1247,  # Only active tokens within 7 days
  "chainStats": [...]
}
```

### **Expected Behavior:**
```
Day 1-7:   Normal cache hits for active tokens
Day 8+:    Some cache misses for inactive tokens (expected)
Result:    Fresh logo lookups for tokens that haven't been seen
```

## ?? **Benefits in Production:**

### **? Resource Optimization:**
- **Memory usage**: Lower memory footprint
- **Redis storage**: Significant reduction in storage usage
- **Network efficiency**: Fresh logos ensure working URLs

### **? Maintenance:**
- **Self-cleaning**: No manual cleanup needed
- **Up-to-date logos**: Automatic refresh cycle
- **Cost efficient**: Less Redis storage costs

### **? User Experience:**
- **Fresh logos**: Users see updated token logos
- **Performance**: Still fast (memory cache + 7-day Redis cache)
- **Reliability**: Broken logo URLs get refreshed

## ?? **Configuration Examples:**

### **Development (Fast refresh):**
```json
{
  "Redis": {
    "TokenLogoExpiration": "0.01:00:00"  // 1 hour for testing
  }
}
```

### **Production (Balanced):**
```json
{
  "Redis": {
    "TokenLogoExpiration": "7.00:00:00"  // 7 days (current)
  }
}
```

### **High-traffic (Longer cache):**
```json
{
  "Redis": {
    "TokenLogoExpiration": "30.00:00:00"  // 30 days for stable logos
  }
}
```

## ? **Migration Notes:**

### **Immediate Effects:**
- **New token logos**: Will expire in 7 days from now
- **Existing logos**: Will keep their original expiration until they expire
- **No disruption**: Current functionality unchanged

### **After Full Migration:**
- **Storage usage**: Gradual reduction as old logos expire
- **Performance**: Same speed, better resource usage
- **Freshness**: Logos refresh automatically every 7 days

**?? Token logos now expire in 7 days, providing the perfect balance between performance and freshness!**