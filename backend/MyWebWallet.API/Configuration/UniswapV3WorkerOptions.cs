namespace MyWebWallet.API.Configuration;

public sealed class UniswapV3WorkerOptions
{
    public bool EnableGranularProcessing { get; set; } = true;
    public TimeSpan GranularOperationTimeout { get; set; } = TimeSpan.FromSeconds(30);
    public int MaxRetryAttempts { get; set; } = 3;
    public TimeSpan JobCompletionTimeout { get; set; } = TimeSpan.FromMinutes(5);
    public double MinSuccessRate { get; set; } = 0.9;
    public int MaxParallelOperations { get; set; } = 8;
}
