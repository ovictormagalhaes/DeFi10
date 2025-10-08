using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Plugins
{
    /// <summary>
    /// Base interface for all protocol plugins
    /// </summary>
    public interface IProtocolPlugin : IChainSupportService
    {
        /// <summary>
        /// Unique identifier for this protocol
        /// </summary>
        string ProtocolId { get; }
        
        /// <summary>
        /// Protocol version
        /// </summary>
        string Version { get; }
        
        /// <summary>
        /// Protocol description
        /// </summary>
        string Description { get; }
        
        /// <summary>
        /// Protocol website URL
        /// </summary>
        string WebsiteUrl { get; }
        
        /// <summary>
        /// Protocol logo URL
        /// </summary>
        string LogoUrl { get; }
        
        /// <summary>
        /// Initialize the plugin with configuration
        /// </summary>
        Task InitializeAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default);
        
        /// <summary>
        /// Validate plugin configuration for a specific chain
        /// </summary>
        Task<ValidationResult> ValidateConfigurationAsync(ChainEnum chain, CancellationToken cancellationToken = default);
        
        /// <summary>
        /// Get wallet items for an account on a specific chain
        /// </summary>
        Task<List<WalletItem>> GetWalletItemsAsync(string accountAddress, ChainEnum chain, CancellationToken cancellationToken = default);
        
        /// <summary>
        /// Check if the plugin is healthy and operational
        /// </summary>
        Task<HealthCheckResult> CheckHealthAsync(ChainEnum? chain = null, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Specialized interface for DeFi protocol plugins
    /// </summary>
    public interface IDeFiProtocolPlugin : IProtocolPlugin
    {
        /// <summary>
        /// Types of DeFi positions this protocol supports
        /// </summary>
        IEnumerable<WalletItemType> SupportedPositionTypes { get; }
        
        /// <summary>
        /// Get specific position data by ID
        /// </summary>
        Task<WalletItem?> GetPositionAsync(string positionId, ChainEnum chain, CancellationToken cancellationToken = default);
        
        /// <summary>
        /// Get historical data for positions (optional)
        /// </summary>
        Task<object?> GetHistoricalDataAsync(string accountAddress, ChainEnum chain, DateTime? fromDate = null, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Health check result for protocol plugins
    /// </summary>
    public class HealthCheckResult
    {
        public bool IsHealthy { get; set; }
        public string Status { get; set; } = "Unknown";
        public TimeSpan ResponseTime { get; set; }
        public Dictionary<string, object> AdditionalData { get; set; } = new();
        public List<string> Errors { get; set; } = new();
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;

        public static HealthCheckResult Healthy(TimeSpan responseTime, string status = "Healthy")
            => new() { IsHealthy = true, Status = status, ResponseTime = responseTime };

        public static HealthCheckResult Unhealthy(string status, IEnumerable<string>? errors = null)
            => new() { IsHealthy = false, Status = status, Errors = errors?.ToList() ?? new() };
    }

    /// <summary>
    /// Validation result for protocol configuration
    /// </summary>
    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public Dictionary<string, object> AdditionalData { get; set; } = new();

        public static ValidationResult Valid() => new() { IsValid = true };
        public static ValidationResult Invalid(IEnumerable<string> errors) => new() { IsValid = false, Errors = errors.ToList() };
    }

    /// <summary>
    /// Plugin metadata for discovery and registration
    /// </summary>
    [AttributeUsage(AttributeTargets.Class)]
    public class ProtocolPluginAttribute : Attribute
    {
        public string ProtocolId { get; }
        public string Name { get; }
        public string Version { get; }

        public ProtocolPluginAttribute(string protocolId, string name, string version)
        {
            ProtocolId = protocolId;
            Name = name;
            Version = version;
        }
    }
}