namespace MyWebWallet.API.Configuration
{
    public class UniswapV3WorkerOptions
    {
        public bool Enabled { get; set; }
        public bool EnableGranularProcessing { get; set; }
        public TimeSpan GranularOperationTimeout { get; set; }
        public int MaxRetryAttempts { get; set; }
        public double MinSuccessRate { get; set; }
    }
}
