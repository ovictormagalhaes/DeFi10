using Microsoft.Extensions.Options;

namespace DeFi10.API.Configuration;

public sealed class UniswapV3WorkerOptions : IValidateOptions<UniswapV3WorkerOptions>
{
    public bool EnableGranularProcessing { get; set; } = true;
    public TimeSpan GranularOperationTimeout { get; set; } = TimeSpan.FromSeconds(30);
    public int MaxRetryAttempts { get; set; } = 3;
    public TimeSpan JobCompletionTimeout { get; set; } = TimeSpan.FromMinutes(5);
    public double MinSuccessRate { get; set; } = 0.9;
    public int MaxParallelOperations { get; set; } = 8;

    public ValidateOptionsResult Validate(string? name, UniswapV3WorkerOptions options)
    {
        if (options.GranularOperationTimeout <= TimeSpan.Zero)
        {
            return ValidateOptionsResult.Fail("UniswapV3Worker:GranularOperationTimeout must be > 0");
        }

        if (options.MaxRetryAttempts < 0)
        {
            return ValidateOptionsResult.Fail("UniswapV3Worker:MaxRetryAttempts must be >= 0");
        }

        if (options.JobCompletionTimeout <= TimeSpan.Zero)
        {
            return ValidateOptionsResult.Fail("UniswapV3Worker:JobCompletionTimeout must be > 0");
        }

        if (options.MinSuccessRate < 0 || options.MinSuccessRate > 1)
        {
            return ValidateOptionsResult.Fail("UniswapV3Worker:MinSuccessRate must be between 0 and 1");
        }

        if (options.MaxParallelOperations <= 0)
        {
            return ValidateOptionsResult.Fail("UniswapV3Worker:MaxParallelOperations must be > 0");
        }

        return ValidateOptionsResult.Success;
    }
}
