using Microsoft.Extensions.DependencyInjection;

namespace MyWebWallet.API.Messaging.Extensions;

/// <summary>
/// Configurações específicas para processamento granular Uniswap V3
/// </summary>
public class UniswapV3WorkerOptions
{
    public const string SectionName = "UniswapV3Workers";
    
    /// <summary>
    /// Timeout para operações granulares individuais (padrão: 30s)
    /// </summary>
    public TimeSpan GranularOperationTimeout { get; set; } = TimeSpan.FromSeconds(30);
    
    /// <summary>
    /// Número máximo de tentativas para operações granulares (padrão: 3)
    /// </summary>
    public int MaxRetryAttempts { get; set; } = 3;
    
    /// <summary>
    /// Timeout para aguardar todas as operações de um job (padrão: 5min)
    /// </summary>
    public TimeSpan JobCompletionTimeout { get; set; } = TimeSpan.FromMinutes(5);
    
    /// <summary>
    /// Percentual mínimo de sucesso para considerar um job como bem-sucedido (padrão: 70%)
    /// </summary>
    public double MinSuccessRate { get; set; } = 0.7;
    
    /// <summary>
    /// Habilitar processamento granular resiliente (padrão: true)
    /// </summary>
    public bool EnableGranularProcessing { get; set; } = true;
    
    /// <summary>
    /// Número máximo de operações paralelas por job (padrão: 10)
    /// </summary>
    public int MaxParallelOperations { get; set; } = 10;
}